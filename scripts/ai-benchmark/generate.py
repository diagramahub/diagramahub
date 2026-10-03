"""G9 benchmark, phase 1 (runs inside the backend container).

Generates 10 descriptions x 4 diagram types per model through the app's own
AI clients (same prompts and cleaning as production), validates PlantUML/D2/
DBML with the real Kroki renderer, and prints one JSON document to stdout.
Mermaid is validated afterwards in a browser with the app's mermaid build.
API keys are read from the local DB through the app's repository and never
printed.

Usage: see scripts/ai-benchmark/README.md
"""

import asyncio
import json
import os
import sys
import time
import urllib.error
import urllib.request

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.api.v1.ai_providers.clients.factory import AIClientFactory
from app.api.v1.ai_providers.repository import AIProviderRepository
from app.api.v1.ai_providers.schemas import AIProviderType, UserAISettingsInDB

CASES = {
    "mermaid": [
        "Flujo de inicio de sesión con usuario y contraseña, verificación de MFA (código por correo o app TOTP), bloqueo tras 5 intentos fallidos y recuperación de contraseña.",
        "Proceso de compra en una tienda en línea: carrito, pago (tarjeta o PayPal), validación de inventario, envío y notificación al cliente (correo y SMS).",
        "Diagrama de secuencia: el usuario sube un archivo, el frontend llama a la API, la API guarda en S3, encola un trabajo y un worker genera miniaturas; al final se notifica por WebSocket.",
        "Diagrama de clases de una biblioteca: Libro, Autor, Ejemplar, Socio, Préstamo y Multa, con sus atributos principales, métodos y relaciones (incluye herencia de Socio a SocioPremium).",
        "Máquina de estados de un pedido: creado, pagado, en preparación, enviado, entregado, cancelado y devuelto, con las transiciones y eventos que las provocan.",
        "Diagrama entidad-relación de un sistema escolar: alumnos, profesores, materias, grupos, inscripciones y calificaciones (incluye cardinalidades).",
        "Arquitectura de microservicios (API Gateway, Auth, Usuarios, Pedidos, Pagos, Notificaciones) con sus bases de datos y una cola de mensajes; agrupa por capas.",
        "Diagrama de Gantt de un proyecto de 8 semanas: análisis (1 semana), diseño (2), desarrollo backend y frontend en paralelo (4), pruebas (1) y lanzamiento.",
        "Flujo de atención en urgencias de un hospital (triage: rojo, amarillo, verde), con decisiones (¿requiere cirugía? ¿hay camas?) y las áreas: admisión, diagnóstico (rayos X / laboratorio), alta.",
        "Mapa mental sobre 'Aprendizaje automático': supervisado (regresión, clasificación), no supervisado (clustering, reducción de dimensionalidad), por refuerzo y aplicaciones.",
    ],
    "plantuml": [
        "Diagrama de secuencia del flujo OAuth 2.0 con PKCE entre navegador, aplicación cliente, servidor de autorización y API de recursos.",
        "Diagrama de casos de uso de un cajero automático: cliente (retirar, depositar, consultar saldo, transferir) y técnico (recargar efectivo, mantenimiento).",
        "Diagrama de clases de un sistema de reservas de hotel: Hotel, Habitación, Huésped, Reserva, Pago y Factura, con multiplicidades.",
        "Diagrama de actividad del proceso de aprobación de gastos: el empleado registra el gasto, el jefe aprueba o rechaza, si es mayor a $10,000 lo aprueba finanzas, luego se paga.",
        "Diagrama de componentes de una plataforma de e-learning: portal web, app móvil, servicio de cursos, servicio de video, servicio de pagos y base de datos.",
        "Diagrama de estados de un ticket de soporte: nuevo, asignado, en progreso, en espera del cliente, resuelto, cerrado y reabierto.",
        "Diagrama de despliegue: balanceador de carga, 3 servidores de aplicación en Kubernetes, base de datos PostgreSQL con réplica y Redis.",
        "Diagrama de secuencia de un pago con tarjeta: cliente, comercio, pasarela de pago, banco emisor; incluye el caso de pago rechazado (alt).",
        "Diagrama de clases del patrón Observer aplicado a notificaciones (correo, SMS, push) de una app de pedidos.",
        "Diagrama de actividad con carriles (swimlanes) para el alta de un empleado: Recursos Humanos, TI y Gerencia.",
    ],
    "d2": [
        "Arquitectura de una app web: navegador, CDN, balanceador, 2 servidores de API, base de datos PostgreSQL y Redis de caché.",
        "Flujo de datos de un pipeline ETL: fuentes (CRM, ERP, archivos CSV), ingesta, transformación con Spark, data warehouse y dashboards.",
        "Red de una oficina: router, firewall, switch principal, 3 departamentos (Ventas, TI, Finanzas) con sus equipos e impresoras, y servidor de archivos.",
        "Arquitectura serverless en AWS: API Gateway, funciones Lambda (crear pedido, procesar pago, enviar correo), DynamoDB, SQS y SES.",
        "Organigrama de una startup: CEO, CTO (equipos de backend, frontend y datos), COO (operaciones y soporte) y CFO (finanzas y legal).",
        "Sistema de recomendación: eventos de usuario, stream de Kafka, servicio de features, modelo de ML, API de recomendaciones y app móvil.",
        "Infraestructura Kubernetes: ingress, namespaces 'prod' y 'staging', deployments de frontend y backend, base de datos gestionada y monitoreo con Prometheus y Grafana.",
        "Flujo de CI/CD: commit en GitHub, pruebas, build de imagen Docker, escaneo de seguridad, despliegue a staging, aprobación manual y despliegue a producción.",
        "Componentes de una app de mensajería: clientes (web, iOS, Android), gateway de WebSocket, servicio de presencia, servicio de mensajes, almacenamiento y notificaciones push.",
        "Arquitectura de un sistema IoT: sensores, gateway MQTT, broker, procesamiento en tiempo real, base de datos de series de tiempo y panel de control.",
    ],
    "dbml": [
        "Base de datos de un blog: usuarios, publicaciones, comentarios, etiquetas (relación muchos a muchos con publicaciones) y likes.",
        "Modelo de datos de un e-commerce: clientes, direcciones, productos, categorías, pedidos, partidas del pedido, pagos e inventario.",
        "Base de datos de una clínica: pacientes, médicos, especialidades, citas, recetas y medicamentos (con índices en fechas de cita).",
        "Modelo de una plataforma de cursos: usuarios, cursos, lecciones, inscripciones, progreso por lección y certificados; incluye un enum de estado de inscripción.",
        "Base de datos multi-tenant de un SaaS de proyectos: organizaciones, miembros (con rol), proyectos, tareas, comentarios y adjuntos.",
        "Modelo de reservas de vuelos: aeropuertos, vuelos, aviones, asientos, pasajeros, reservas y boletos.",
        "Base de datos de un sistema de nómina: empleados, departamentos, puestos, periodos de pago, percepciones y deducciones.",
        "Modelo de una red social: usuarios, seguidores (auto-relación), publicaciones, reacciones con un enum de tipo de reacción y mensajes directos.",
        "Base de datos de inventario de almacén: almacenes, ubicaciones, productos, lotes con fecha de caducidad, movimientos de entrada y salida.",
        "Modelo de un sistema de tickets de soporte: clientes, agentes, tickets (con prioridad y estado como enums), mensajes y SLA por prioridad.",
    ],
}

KROKI_TYPES = {"plantuml": "plantuml", "d2": "d2", "dbml": "dbml"}


def kroki_validate(diagram_type: str, code: str) -> tuple[bool, str]:
    request = urllib.request.Request(
        f"http://kroki:8000/{KROKI_TYPES[diagram_type]}/svg",
        data=code.encode("utf-8"),
        headers={"Content-Type": "text/plain"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status == 200, ""
    except urllib.error.HTTPError as exc:
        return False, exc.read()[:200].decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001
        return False, f"kroki: {exc}"[:200]


async def run_case(client, model: str, diagram_type: str, index: int, description: str, sem) -> dict:
    async with sem:
        started = time.time()
        result = {"model": model, "type": diagram_type, "case": index}
        try:
            code = await asyncio.wait_for(
                client.generate_diagram(description=description, diagram_type=diagram_type, language="es"),
                180,
            )
            result.update(ok_call=True, code=code, seconds=round(time.time() - started, 1))
        except Exception as exc:  # noqa: BLE001
            result.update(ok_call=False, code="", error=str(exc)[:300], seconds=round(time.time() - started, 1))
            return result
        if diagram_type in KROKI_TYPES:
            valid, message = await asyncio.to_thread(kroki_validate, diagram_type, code)
            result.update(valid=valid, validation_error=message)
        return result


async def main() -> None:
    email, label, targets = sys.argv[1], sys.argv[2], sys.argv[3:]
    db = AsyncIOMotorClient(os.environ["MONGO_URI"])[os.environ["DATABASE_NAME"]]
    await init_beanie(database=db, document_models=[UserAISettingsInDB])
    user_id = str((await db.users.find_one({"email": email}))["_id"])
    repo = AIProviderRepository()
    sem = asyncio.Semaphore(4)
    tasks = []
    for target in targets:
        provider, model = target.split(":", 1)
        config = await repo.get_active_provider(user_id, AIProviderType(provider))
        client = AIClientFactory.create_client(
            provider=AIProviderType(provider), api_key=config.api_key, model=model, parameters=config.parameters or {}
        )
        for diagram_type, descriptions in CASES.items():
            for index, description in enumerate(descriptions):
                tasks.append(run_case(client, model, diagram_type, index, description, sem))
    results = await asyncio.gather(*tasks)
    print(json.dumps({"label": label, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

"""Mermaid diagram types benchmark, phase 1 (runs inside the backend container).

Measures what the Mermaid syntax reference (ai_providers/mermaid_reference.json)
is for: does the model use the requested newer type (Venn, Wardley, Kanban, …)
and does it render? Also fixes broken diagrams of those types
(mermaid_fix_cases.json, with the parser's real error), and re-runs the 10
classic Mermaid cases of generate.py to catch regressions, plus requests for
the flowchart extras (animated edges, step-by-step animation, BPMN shapes). With --chat it goes
through the real chat (chat.py) instead of generate/fix. Prints JSON; phase 2:
validate_mermaid_types.js.

Usage: see scripts/ai-benchmark/README.md
"""

import asyncio
import json
import os
import sys
import time

from beanie import init_beanie
from pymongo import AsyncMongoClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate import CASES  # noqa: E402

from app.api.v1.ai_providers.clients.factory import AIClientFactory  # noqa: E402
from app.api.v1.ai_providers.repository import AIProviderRepository  # noqa: E402
from app.api.v1.ai_providers.schemas import AIProviderType, UserAISettingsInDB  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CLASSIC = CASES["mermaid"]
with open(os.path.join(HERE, "mermaid_fix_cases.json"), encoding="utf-8") as _f:
    FIX_CASES = json.load(_f)

# One natural request per newer type (Spanish, like real users); the key is the
# header the model should pick.
MODERN = {
    "mindmap": "Mapa mental sobre cómo preparar un viaje: documentos, presupuesto, transporte, hospedaje y actividades, con 2-3 ideas en cada rama.",
    "timeline": "Línea de tiempo de la historia de la web: 1991 primera página, 1995 JavaScript, 2004 Web 2.0, 2008 Chrome, 2015 ES6, 2020 pandemia y trabajo remoto.",
    "quadrantChart": "Matriz de esfuerzo contra impacto (cuadrantes) para priorizar 6 iniciativas de un equipo de producto.",
    "journey": "Recorrido del cliente (user journey) al comprar un boleto de avión en línea, con su nivel de satisfacción en cada paso.",
    "requirementDiagram": "Diagrama de requisitos de un sistema de login: requisito de autenticación con MFA, requisito de bloqueo tras intentos fallidos, y el elemento que los satisface.",
    "C4Context": "Diagrama de contexto C4 de una plataforma bancaria: cliente, sistema de banca en línea, sistema de correo y mainframe del banco.",
    "sankey-beta": "Diagrama de Sankey del flujo de energía de un hogar: electricidad y gas hacia calefacción, cocina, iluminación y electrodomésticos, con cantidades.",
    "xychart-beta": "Gráfica de barras y línea con las ventas mensuales de enero a junio de una tienda.",
    "block-beta": "Diagrama de bloques de una computadora: CPU, memoria, almacenamiento, GPU y periféricos conectados por el bus.",
    "packet": "Estructura de un paquete UDP en bits: puerto origen, puerto destino, longitud y checksum.",
    "kanban": "Tablero kanban de un sprint con columnas Por hacer, En progreso y Hecho, y 6 tareas repartidas.",
    "architecture-beta": "Diagrama de arquitectura (architecture-beta) de una app en la nube: internet, balanceador, 2 servidores, base de datos y almacenamiento de archivos dentro de un grupo de nube.",
    "radar-beta": "Gráfica de radar comparando dos laptops en precio, batería, rendimiento, pantalla y peso.",
    "treemap-beta": "Treemap del presupuesto anual de una empresa por departamento y subárea, con montos.",
    "venn-beta": "Diagrama de Venn de las habilidades de un científico de datos: matemáticas, programación y conocimiento del negocio, con sus intersecciones.",
    "usecase-beta": "Diagrama de casos de uso de una biblioteca: socio (buscar libro, reservar, renovar préstamo) y bibliotecario (registrar préstamo, dar de alta libros).",
    "swimlane-beta": "Diagrama de carriles (swimlanes) del proceso de reembolso de gastos entre Empleado, Jefe y Finanzas.",
    "agentflow-beta": "Flujo de un agente de IA (agentflow) que recibe una pregunta, busca en documentos con una herramienta, decide si tiene suficiente contexto y responde.",
    "ishikawa-beta": "Diagrama de Ishikawa (espina de pescado) de por qué se retrasan las entregas de un restaurante: personal, cocina, transporte y pedidos.",
    "cynefin-beta": "Marco Cynefin para clasificar problemas de un equipo de TI en los dominios claro, complicado, complejo y caótico.",
    "wardley-beta": "Mapa de Wardley de una tienda en línea: cliente, sitio web, catálogo, pagos, hosting en la nube y electricidad.",
    "treeView-beta": "Árbol de carpetas de un proyecto de React con src, components, pages, hooks, public y archivos de configuración.",
    "eventmodeling": "Event modeling del registro de un usuario: pantalla de registro, comando registrar, evento usuario registrado y la vista del perfil.",
    "railroad-beta": "Diagrama de sintaxis (railroad) de un número decimal: signo opcional, dígitos, punto y decimales opcionales.",
}


# Flowchart extras: the case key names the feature the model should use (checked by
# validate_mermaid_types.js against the code).
FEATURES = {
    "animate": "Diagrama de flujo del despliegue de una app (commit, build, pruebas, despliegue) con las flechas animadas para que se vea el movimiento.",
    "animate-2": "Flujo de un pedido en línea donde las conexiones se muevan (flechas con animación), con la conexión del pago más rápida que las demás.",
    "step": "Flujo de una petición HTTP (cliente, balanceador, API, caché, base de datos) animado paso a paso: que un punto recorra las conexiones en orden y se vea el número de cada paso.",
    "step-2": "Animación por pasos del proceso de login: usuario, formulario, API, verificación MFA y panel, mostrando el orden numerado.",
    "bpmn": "Proceso BPMN de aprobación de vacaciones: evento de inicio, tareas, compuerta de decisión (aprobada o no), evento intermedio de notificación y evento de fin.",
    "bpmn-2": "Diagrama BPMN del proceso de compra con evento inicial, actividades, una compuerta, un almacén de datos de pedidos y evento final.",
}


async def timed(coro):
    started = time.time()
    try:
        value = await asyncio.wait_for(coro, 240)
        return {"ok_call": True, "value": value, "seconds": round(time.time() - started, 1)}
    except Exception as exc:  # noqa: BLE001
        return {"ok_call": False, "error": str(exc)[:300], "seconds": round(time.time() - started, 1)}


async def generate(client, model, kind, case, description, sem):
    async with sem:
        r = await timed(client.generate_diagram(description=description, diagram_type="mermaid", language="es"))
        return {"model": model, "task": "generate", "kind": kind, "case": case, "code": r.pop("value", ""), **r}


async def fix(client, model, case, sem):
    async with sem:
        r = await timed(client.fix_diagram(case["code"], "mermaid", case["error"], "es"))
        value = r.pop("value", None) or {}
        return {"model": model, "task": "fix", "kind": "modern", "case": case["keyword"],
                "code": value.get("corrected_code", ""), **r}


async def chat(user_id, provider, model, kind, case, description, sem):
    from chat import run_case

    r = await run_case(user_id, provider, model, "mermaid", case, description, sem)
    r.pop("valid", None)
    return {**r, "task": "chat", "kind": kind, "case": case, "code": r.get("code", "")}


async def main() -> None:
    args = sys.argv[1:]
    use_chat = "--chat" in args
    email, label, *targets = [a for a in args if a != "--chat"]
    db = AsyncMongoClient(os.environ["MONGO_URI"])[os.environ["DATABASE_NAME"]]
    await init_beanie(database=db, document_models=[UserAISettingsInDB])
    user_id = str((await db.users.find_one({"email": email}))["_id"])
    sem = asyncio.Semaphore(6)
    tasks = []
    for target in targets:
        provider, model = target.split(":", 1)
        cases = (
            [("classic", i, d) for i, d in enumerate(CLASSIC)]
            + [("modern", k, d) for k, d in MODERN.items()]
            + [("feature", k, d) for k, d in FEATURES.items()]
        )
        if use_chat:
            tasks += [chat(user_id, provider, model, kind, case, d, sem) for kind, case, d in cases]
            continue
        config = await AIProviderRepository().get_active_provider(user_id, AIProviderType(provider))
        client = AIClientFactory.create_client(
            provider=AIProviderType(provider), api_key=config.api_key, model=model, parameters=config.parameters or {}
        )
        tasks += [generate(client, model, kind, case, d, sem) for kind, case, d in cases]
        tasks += [fix(client, model, case, sem) for case in FIX_CASES]
    results = await asyncio.gather(*tasks)
    print(json.dumps({"label": label, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

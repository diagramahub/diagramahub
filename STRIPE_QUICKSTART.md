# 🚀 Guía Rápida: Pruebas con Stripe Sandbox

Esta guía te ayudará a configurar Stripe en modo sandbox (test) para realizar tus primeras pruebas de checkout.

## 📋 Checklist Pre-Pruebas

- [ ] Cuenta de Stripe creada
- [ ] API Keys de test obtenidas
- [ ] Webhook configurado
- [ ] Variables de entorno configuradas
- [ ] Servicios Docker corriendo
- [ ] Plan FREE creado en BD
- [ ] Usuario admin creado

---

## 🔧 Paso 1: Obtener Credenciales de Stripe (5 minutos)

### 1.1 Crear/Acceder a Cuenta Stripe

1. Ve a https://dashboard.stripe.com/register
2. Crea una cuenta o inicia sesión
3. **Asegúrate de estar en modo TEST** (toggle en la esquina superior derecha)

### 1.2 Obtener API Keys

1. En el Dashboard, ve a: **Developers** → **API keys**
2. Copia las siguientes keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...` (haz clic en "Reveal live key")

### 1.3 Configurar Webhook (Temporal para desarrollo)

**Opción A: Usar Stripe CLI (Recomendado para desarrollo local)**

```bash
# Instalar Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/

# Login
stripe login

# Iniciar forwarding (deja esta terminal abierta)
stripe listen --forward-to localhost:5172/api/v1/webhooks/stripe
```

El CLI te dará un webhook secret que empieza con `whsec_...` - cópialo.

**Opción B: Usar ngrok (Si no puedes usar Stripe CLI)**

```bash
# Instalar ngrok
# macOS
brew install ngrok

# Iniciar túnel
ngrok http 5172

# Copia la URL HTTPS que te da (ej: https://abc123.ngrok.io)
```

Luego en Stripe Dashboard:
1. Ve a **Developers** → **Webhooks**
2. Click **Add endpoint**
3. URL: `https://tu-url-ngrok.ngrok.io/api/v1/webhooks/stripe`
4. Selecciona estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copia el webhook secret

---

## 🔐 Paso 2: Configurar Variables de Entorno

Edita el archivo `backend/.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_TU_SECRET_KEY_AQUI
STRIPE_PUBLISHABLE_KEY=pk_test_TU_PUBLISHABLE_KEY_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET_AQUI

# Frontend URL (para redirects después del checkout)
FRONTEND_URL=http://localhost:5173
```

**Reinicia el backend** para que tome las nuevas variables:

```bash
docker-compose restart backend
```

---

## 🎯 Paso 3: Preparar Datos de Prueba

### 3.1 Verificar Plan FREE

```bash
# Conectarse a MongoDB
docker exec -it diagramahub-mongodb mongosh diagramahub

# Verificar que existe el plan FREE
db.plans.find({ is_free: true }).pretty()

# Si no existe, crearlo:
docker exec -it diagramahub-backend python scripts/create_free_plan.py
```

### 3.2 Crear Plan de Pago de Prueba

1. Accede a: http://localhost:5173/profile?tab=admin
2. Haz clic en "Crear Nuevo Plan"
3. Completa:
   - **Nombre**: Pro
   - **Descripción**: Plan profesional con recursos ilimitados
   - **Precio**: 9.99 USD/mes
   - **Max Proyectos**: -1 (ilimitado)
   - **Max Diagramas**: -1 (ilimitado)
4. Guarda el plan

---

## 🧪 Paso 4: Realizar Primera Prueba de Checkout

### 4.1 Acceder como Usuario

1. Ve a: http://localhost:5173/profile?tab=subscription
2. Verás tu plan actual (FREE)
3. Haz clic en **"Cambiar Plan"**
4. Selecciona el plan **"Pro"**
5. Haz clic en **"Seleccionar"**

### 4.2 Completar Checkout en Stripe

Serás redirigido a Stripe Checkout. Usa estos datos de prueba:

**Tarjeta de Prueba (Pago Exitoso):**
- Número: `4242 4242 4242 4242`
- Fecha: Cualquier fecha futura (ej: `12/34`)
- CVC: Cualquier 3 dígitos (ej: `123`)
- ZIP: Cualquier código (ej: `12345`)
- Email: Tu email de prueba

**Otras Tarjetas de Prueba:**
- `4000 0000 0000 0002` - Tarjeta declinada
- `4000 0000 0000 9995` - Fondos insuficientes
- `4000 0025 0000 3155` - Requiere autenticación 3D Secure

### 4.3 Verificar Resultado

Después del pago exitoso:

1. **Serás redirigido** de vuelta a DiagramaHub
2. **Verifica tu suscripción**: Ve a Profile → Mi Suscripción
3. **Deberías ver**:
   - Plan: Pro
   - Estado: Active
   - Precio: $9.99/month
   - Recursos: Unlimited projects/diagrams

### 4.4 Verificar en Stripe Dashboard

1. Ve a: https://dashboard.stripe.com/test/payments
2. Deberías ver el pago de $9.99
3. Ve a: https://dashboard.stripe.com/test/subscriptions
4. Deberías ver la suscripción activa

---

## 🔍 Paso 5: Verificar Webhooks

### 5.1 Ver Logs del Backend

```bash
docker logs diagramahub-backend --tail 50 | grep webhook
```

Deberías ver logs como:
```
INFO: Webhook received: checkout.session.completed
INFO: Subscription activated for user: ...
```

### 5.2 Ver Eventos en Stripe

1. Ve a: https://dashboard.stripe.com/test/webhooks
2. Haz clic en tu endpoint
3. Ve a la pestaña **"Recent events"**
4. Deberías ver eventos como:
   - `checkout.session.completed` ✅
   - `customer.subscription.created` ✅

---

## 🧪 Paso 6: Probar Otros Flujos

### 6.1 Probar Cancelación

1. Ve a Profile → Mi Suscripción
2. Haz clic en **"Cancel Subscription"**
3. Confirma la cancelación
4. Verifica que:
   - Estado cambia a "Cancelled"
   - Aún tienes acceso hasta el fin del período
   - Se muestra la fecha de fin de acceso

### 6.2 Probar Límites de Recursos

1. Con plan FREE (1 proyecto, 10 diagramas):
   - Intenta crear 2 proyectos → Debería bloquearte
   - Mensaje: "Has alcanzado el límite de proyectos"

2. Con plan Pro (ilimitado):
   - Crea múltiples proyectos → Debería permitirte

### 6.3 Probar Cambio de Plan

1. Cambia de Pro a FREE:
   - Debería ser inmediato (sin checkout)
   - Límites se aplican inmediatamente

2. Cambia de FREE a Pro:
   - Debería abrir Stripe Checkout
   - Después del pago, plan se activa

---

## 📊 Monitoreo Durante Pruebas

### Terminal 1: Backend Logs
```bash
docker logs -f diagramahub-backend
```

### Terminal 2: Stripe CLI (si lo usas)
```bash
stripe listen --forward-to localhost:5172/api/v1/webhooks/stripe
```

### Terminal 3: MongoDB (opcional)
```bash
docker exec -it diagramahub-mongodb mongosh diagramahub
# Luego ejecuta queries como:
db.subscriptions.find().pretty()
db.plans.find().pretty()
```

---

## ❌ Troubleshooting

### Problema: "Stripe not configured"

**Solución:**
```bash
# Verifica que las variables estén en .env
cat backend/.env | grep STRIPE

# Reinicia el backend
docker-compose restart backend
```

### Problema: Webhook no se recibe

**Solución:**
1. Verifica que Stripe CLI esté corriendo
2. O verifica que ngrok esté activo
3. Revisa los logs del backend
4. Verifica en Stripe Dashboard → Webhooks → Recent events

### Problema: Checkout no redirige de vuelta

**Solución:**
```bash
# Verifica FRONTEND_URL en .env
echo $FRONTEND_URL  # Debería ser http://localhost:5173

# Reinicia backend
docker-compose restart backend
```

### Problema: Suscripción no se activa

**Solución:**
1. Verifica que el webhook `checkout.session.completed` se recibió
2. Revisa logs del backend para errores
3. Verifica en MongoDB que la suscripción existe:
   ```bash
   docker exec -it diagramahub-mongodb mongosh diagramahub
   db.subscriptions.find({ status: "active" }).pretty()
   ```

---

## ✅ Checklist de Pruebas Completadas

- [ ] Checkout exitoso con tarjeta de prueba
- [ ] Suscripción activada correctamente
- [ ] Webhook recibido y procesado
- [ ] Plan actualizado en perfil de usuario
- [ ] Límites de recursos funcionando
- [ ] Cancelación de suscripción funciona
- [ ] Cambio de plan FREE → Pro funciona
- [ ] Cambio de plan Pro → FREE funciona
- [ ] Indicador de uso en navbar funciona
- [ ] Historial visible en Stripe Dashboard

---

## 📚 Recursos Adicionales

- **Stripe Dashboard Test**: https://dashboard.stripe.com/test
- **Documentación Completa**: `backend/docs/STRIPE_SETUP.md`
- **Tarjetas de Prueba**: https://stripe.com/docs/testing
- **Stripe CLI Docs**: https://stripe.com/docs/stripe-cli

---

## 🎉 ¡Listo para Producción!

Una vez que todas las pruebas pasen:

1. Obtén las API keys de **LIVE mode** en Stripe
2. Actualiza `.env` con las keys de producción
3. Configura webhook de producción con tu dominio real
4. Verifica que todo funcione en producción
5. ¡Lanza tu sistema de suscripciones!

---

**¿Necesitas ayuda?** Revisa:
- Logs del backend: `docker logs diagramahub-backend`
- Stripe Dashboard para detalles de pagos y webhooks
- MongoDB para verificar datos: `docker exec -it diagramahub-mongodb mongosh diagramahub`

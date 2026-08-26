# GoFitten

Tienda de ropa deportiva al por mayor con catálogo, carrito y pedidos por WhatsApp,
más un **panel privado para los dueños**.

## Cómo se ejecuta

```bash
npm install
npm start          # http://localhost:3000
```

- Tienda: `/`
- Panel de dueños: `/admin` (pide usuario y contraseña)

## Panel de dueños

Se entra por `/admin` o por el enlace **"Acceso dueños"** al final de la tienda.

**Usuario inicial:** `admin`
**Contraseña inicial:** `gofitten2026` → **cámbiala apenas entres**, en la pestaña *Cuenta*.

Para fijar otras credenciales de arranque, define estas variables de entorno antes
del primer inicio (solo se usan cuando todavía no existe ninguna cuenta):

| Variable | Para qué sirve |
|---|---|
| `ADMIN_USER` | usuario del primer dueño |
| `ADMIN_PASSWORD` | su contraseña |
| `SESSION_SECRET` | clave para firmar las sesiones (si no, se genera sola) |
| `DATA_DIR` | carpeta donde se guardan pedidos y usuarios |

### Qué se puede hacer

**Pedidos** — historial de todo lo que los clientes envían por WhatsApp: productos,
tallas, cantidades, totales, datos de entrega y teléfono. Se puede buscar, filtrar por
estado (nuevo / confirmado / entregado / cancelado), dejar una nota interna, eliminar
y exportar a CSV para Excel.

**Productos** — buscar entre todo el catálogo y editar nombre, precio, precio tachado
y descripción; marcar **agotado**, marcar como **oferta** o **deshabilitar** un producto
para que desaparezca de la tienda. Cualquier producto se puede devolver a sus datos
originales con *Restaurar original*.

**Cuenta** — cambiar la contraseña propia y dar acceso a otros dueños.

## Dónde se guardan los datos

En la carpeta `DATA_DIR` (por defecto `./data-store`, que no se sube a git):

- `orders.json` — historial de pedidos
- `product-overrides.json` — cambios hechos a los productos
- `admins.json` — usuarios y contraseñas cifradas
- `config.json` — clave de firma de sesiones

El catálogo base (`js/products.js`) no se toca: el panel guarda solo los cambios y
la tienda los aplica al cargar.

## Importante al desplegar en Railway

El disco de Railway se borra en cada despliegue. Para no perder los pedidos:

1. Añade un **Volume** al servicio y móntalo, por ejemplo, en `/data`.
2. Crea la variable de entorno `DATA_DIR=/data`.
3. Define también `SESSION_SECRET` (cualquier texto largo y aleatorio) para que las
   sesiones abiertas no se caigan al reiniciar.

Sin volumen la tienda funciona igual, pero los pedidos y los cambios de productos
se pierden en cada despliegue.

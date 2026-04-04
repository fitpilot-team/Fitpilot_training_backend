# AGENTS.md — fitpilot-nutrition-backend

## Propósito

Este archivo define cómo debe trabajar un agente automático dentro de `fitpilot-nutrition-backend`.

La prioridad es:
1. hacer cambios pequeños, seguros y reversibles,
2. no ejecutar comandos destructivos o costosos sin instrucción explícita,
3. respetar el flujo real del proyecto y su integración con el workspace principal.

---

## Contexto del proyecto

- Este proyecto es un backend NestJS.
- Usa `pnpm` como package manager.
- La base de datos es PostgreSQL con Prisma.
- El proyecto forma parte del workspace FitPilot y normalmente se levanta desde el compose raíz.
- La base de datos está tratada como **remote-only**; no asumir una BD local.
- Hay validaciones y migraciones de esquema que forman parte del flujo operativo del entorno, no del trabajo rutinario de edición.

---

## Reglas generales para el agente

### Sí hacer por defecto
- Leer el código antes de modificarlo.
- Hacer cambios mínimos y enfocados al objetivo solicitado.
- Mantener el estilo existente del repo.
- Explicar brevemente qué se cambió y por qué.
- Cuando sea posible, validar de forma estática:
  - lectura del código,
  - consistencia de imports,
  - tipos,
  - revisión de lógica,
  - lint **solo si se solicita** o si es estrictamente necesario para validar un cambio puntual.

### No hacer por defecto
- No refactorizar partes no relacionadas.
- No actualizar dependencias.
- No cambiar variables de entorno, Docker, CI/CD o infraestructura, salvo instrucción explícita.
- No tocar secretos, credenciales, URLs reales ni configuración sensible.
- No asumir que puede conectarse a la base de datos.

---

## Política de ejecución de comandos

### Tests
**No correr tests a menos que el usuario lo indique explícitamente.**

Esto incluye, sin limitarse a:
- `pnpm test`
- `pnpm test:watch`
- `pnpm test:cov`
- `pnpm test:e2e`
- cualquier variante de `jest`

Aunque exista un cambio que normalmente ameritaría pruebas, el agente debe:
- mencionar qué pruebas serían recomendables,
- pero **no ejecutarlas** sin autorización explícita.

---

## Política estricta sobre Prisma

### Prohibido por defecto
El agente **no debe ejecutar**, salvo instrucción explícita del usuario, ninguno de los siguientes comandos ni equivalentes:

#### Generación de cliente
- `npx prisma generate`
- `pnpm prisma generate`

#### Sincronización de esquema
- `npx prisma db push`
- `pnpm prisma db push`
- `npx prisma db pull`
- `pnpm prisma db pull`

#### Migraciones
- `npx prisma migrate dev`
- `pnpm prisma migrate dev`
- `npx prisma migrate deploy`
- `pnpm prisma migrate deploy`
- `npx prisma migrate reset`
- `pnpm prisma migrate reset`
- `npx prisma migrate status`
- `pnpm prisma migrate status`
- `npx prisma migrate diff`
- `pnpm prisma migrate diff`

#### Otros comandos de riesgo sobre BD
- cualquier comando de Prisma que:
  - altere esquema,
  - regenere cliente manualmente,
  - introspecte la BD,
  - empuje cambios,
  - haga pull del esquema,
  - cree, aplique o resetee migraciones.

### Regla adicional importante
Aunque el proyecto o Docker tenga pasos internos que ejecuten Prisma durante build o arranque, el agente **no debe dispararlos manualmente** como parte de su flujo normal, a menos que el usuario lo pida de forma explícita.

---

## Qué hacer si el cambio toca Prisma o base de datos

Si una tarea afecta:
- `prisma/schema.prisma`,
- modelos,
- relaciones,
- queries dependientes del schema,
- repositorios o servicios que dependen de Prisma,

el agente debe:

1. hacer únicamente el cambio de código solicitado,
2. advertir que el cambio **podría requerir** validación posterior,
3. no correr generación, push, pull ni migraciones,
4. no asumir acceso válido a la BD,
5. dejar claro qué comando tendría que ejecutar una persona después, **solo como recomendación textual**, no como acción automática.

Ejemplo de redacción:
> “Este cambio modifica código relacionado con Prisma. No ejecuté tests ni comandos de Prisma. Si quieres validar el flujo completo, después puedes indicar explícitamente qué comando deseas que corra.”

---

## Comandos permitidos por defecto

Solo cuando sean necesarios para inspección o edición segura, el agente puede usar comandos no destructivos como:

- `ls`
- `find`
- `cat`
- `grep`
- `sed`
- `pnpm lint` **solo si el usuario lo pide o si lo autoriza**
- `pnpm build` **solo si el usuario lo pide o si lo autoriza**

Si hay duda sobre si un comando puede tocar BD, tests o Prisma, el agente debe asumir que **no debe correrlo**.

---

## Estrategia de cambios

### Preferir
- cambios pequeños,
- diffs fáciles de revisar,
- preservar nombres y patrones existentes,
- no mover archivos sin necesidad,
- no introducir abstracciones nuevas si no son necesarias.

### Evitar
- refactors masivos,
- cambios cosméticos globales,
- renombrados amplios,
- modificaciones de scripts del proyecto sin solicitud directa.

---

## Validación esperada del agente

Cuando termine una tarea, el agente debe reportar:

- archivos modificados,
- resumen corto del cambio,
- riesgos o puntos a revisar,
- aclaración explícita de que:

```text
No corrí tests.
No ejecuté prisma generate.
No ejecuté prisma db push / db pull.
No ejecuté migraciones.
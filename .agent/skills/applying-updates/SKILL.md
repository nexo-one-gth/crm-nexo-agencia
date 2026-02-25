---
name: applying-updates
description: Ejecuta el flujo estandar para aplicar cambios al código, subir a GitHub y desplegar a Vercel. Úsalo cuando el usuario te pida "aplicar los cambios", "actualizar el repo", o "hacer commit y subir".
---

# Aplicador de Cambios (Applying Updates)

## Cuándo usar este skill

- Cuando el usuario indique que ha finalizado una funcionalidad y quiere "subir los cambios" o "aplicar actualizaciones".
- Cuando el usuario te pida ejecutar la batería de tests o linting antes de hacer un commit.
- Cuando el usuario solicite un despliegue rápido o sincronización general.

## Flujo de trabajo

Copia y actualiza esta checklist a medida que avanzas:

```markdown
- [ ] 1. Linting y Formateo (`npm run lint`)
- [ ] 2. Verificación de Tipos (`npx tsc --noEmit`)
- [ ] 3. Prueba de Compilación (`npm run build`)
- [ ] 4. Git Add y Commit (`git add .` y `git commit -m "..."`)
- [ ] 5. Despliegue a Producción (`git push`)
```

## Instrucciones

Ejecuta el siguiente flujo paso a paso. **ATENCIÓN: Si algún paso falla, tu prioridad absoluta es DEPURAR y RESOLVER el error de forma autónoma antes de avanzar al siguiente paso.** No te detengas en un error a menos que, tras varios intentos, no logres solucionarlo. Solo en ese caso, notifica al usuario especificando el error.

### Paso 1: Linting
Ejecuta:
```bash
npm run lint
```
- **Si hay errores ESLint/Prettier:** Usa las herramientas de edición de archivos (`replace_file_content` o `multi_replace_file_content`) para corregir los problemas en el código fuente de forma automática. Vuelve a ejecutar `npm run lint` hasta que pase en limpio.

### Paso 2: Verificación de Tipos (TypeScript)
Ejecuta:
```bash
npx tsc --noEmit
```
- **Si hay errores de tipado:** Revisa las interfaces y tipos generados (especialmente con Supabase o Zod). Corrige los tipos en el código y repite el comando hasta asegurar que la validación sea exitosa.

### Paso 3: Compilación (Build)
Ejecuta:
```bash
npm run build
```
- **Si el build falla:** Lee cuidadosamente los logs del terminal para entender por qué Vercel fallará de antemano. Corrige los problemas de rutas, hidratación, server components u otros, y reintenta el build.

### Paso 4: Git Commit
Asegúrate de haber comprendido los cambios realizados mediante una revisión del `git status` y `git diff`.
1. Añade los cambios:
   ```bash
   git add .
   ```
2. Realiza el commit usando Conventional Commits (ej. `feat: ...`, `fix: ...`, `style: ...`, `refactor: ...`):
   ```bash
   git commit -m "tipo: descripción clara y concisa"
   ```

### Paso 5: Git Push (Despliegue)
Sube los cambios al repositorio remoto, lo que disparará el despliegue automático en Vercel:
```bash
git push
```
- **Si hay conflictos (git rebase/merge):** Resuélvelos obteniendo los últimos cambios (`git pull --rebase`), solucionando los conflictos en los archivos afectados, e intentando empujar nuevamente.

## Recursos
- [Next.js Documentation](https://nextjs.org/docs) - Para resolver errores de build.
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) - Para estructurar correctamente los mensajes de commit.

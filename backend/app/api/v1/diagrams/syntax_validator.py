"""
Validador de sintaxis para diagramas Mermaid, PlantUML, D2 y DBML.
"""

import re
from typing import Optional
from pydantic import BaseModel, Field

from .mermaid_types import (
    MERMAID_DIAGRAM_KEYWORDS,
    SUBGRAPH_DIAGRAMS,
    mermaid_diagram_keyword,
    mermaid_header_line,
)


class ValidationResult(BaseModel):
    """Resultado de validación de sintaxis."""

    is_valid: bool = Field(..., description="Si el código es sintácticamente válido")
    error_message: Optional[str] = Field(
        None, description="Mensaje de error si la validación falla"
    )
    error_line: Optional[int] = Field(None, description="Número de línea del error")


class SyntaxValidator:
    """Validador de sintaxis para diagramas Mermaid, PlantUML, D2 y DBML."""

    # Tipos de diagrama Mermaid válidos (los de la versión que renderiza el frontend)
    VALID_MERMAID_TYPES = list(MERMAID_DIAGRAM_KEYWORDS)

    @staticmethod
    async def validate_mermaid(code: str) -> ValidationResult:
        """
        Validar la estructura de un diagrama Mermaid.

        Solo comprueba lo que se puede comprobar sin el parser de Mermaid (que vive
        en el navegador): que empiece con un tipo de diagrama conocido, saltando el
        front matter (``---``) y las líneas ``%%``, y que los subgrafos de los
        diagramas que los usan estén cerrados. ``end`` también cierra bloques en
        otros diagramas (loop/alt en sequenceDiagram, bloques en block), así que el
        balance solo se cuenta en flowchart, graph y swimlane.

        Args:
            code: Código del diagrama Mermaid

        Returns:
            ValidationResult con resultado de validación
        """
        try:
            if not code or not code.strip():
                return ValidationResult(
                    is_valid=False, error_message="El código del diagrama está vacío"
                )

            header, header_line = mermaid_header_line(code)
            keyword = mermaid_diagram_keyword(code)
            if keyword is None:
                shown = header[:60] if header else "(vacío)"
                return ValidationResult(
                    is_valid=False,
                    error_message=(
                        f"Tipo de diagrama Mermaid no reconocido: «{shown}». La primera línea "
                        "(después del front matter) debe ser el tipo, por ejemplo flowchart LR, "
                        "sequenceDiagram, classDiagram o venn-beta"
                    ),
                    error_line=header_line or 1,
                )

            if keyword not in SUBGRAPH_DIAGRAMS:
                return ValidationResult(is_valid=True)

            subgraph_count = 0
            for i, line in enumerate(code.split("\n"), start=1):
                line_clean = re.sub(r"%%.*$", "", line).strip()

                if re.match(r"subgraph\b", line_clean):
                    subgraph_count += 1
                if line_clean == "end":
                    subgraph_count -= 1

                if subgraph_count < 0:
                    return ValidationResult(
                        is_valid=False,
                        error_message="'end' sin 'subgraph' correspondiente",
                        error_line=i,
                    )

            if subgraph_count > 0:
                return ValidationResult(
                    is_valid=False,
                    error_message=f"{subgraph_count} subgraph(s) sin cerrar (falta 'end')",
                )

            return ValidationResult(is_valid=True)

        except Exception as e:
            return ValidationResult(
                is_valid=False, error_message=f"Error al validar sintaxis: {str(e)}"
            )

    @staticmethod
    async def validate_plantuml(code: str) -> ValidationResult:
        """
        Validar sintaxis de PlantUML.

        Args:
            code: Código del diagrama PlantUML

        Returns:
            ValidationResult con resultado de validación
        """
        try:
            # Verificar código vacío
            if not code or not code.strip():
                return ValidationResult(
                    is_valid=False, error_message="El código del diagrama está vacío"
                )

            # Verificar presencia de @startuml
            if "@startuml" not in code:
                return ValidationResult(
                    is_valid=False,
                    error_message="Falta la etiqueta @startuml al inicio del diagrama",
                    error_line=1,
                )

            # Verificar presencia de @enduml
            if "@enduml" not in code:
                return ValidationResult(
                    is_valid=False, error_message="Falta la etiqueta @enduml al final del diagrama"
                )

            # Verificar orden correcto de tags
            start_pos = code.find("@startuml")
            end_pos = code.find("@enduml")

            if start_pos > end_pos:
                return ValidationResult(
                    is_valid=False, error_message="@enduml aparece antes de @startuml"
                )

            # Verificar balance de bloques comunes
            lines = code.split("\n")
            block_stack = []

            for i, line in enumerate(lines, start=1):
                line_clean = line.strip()

                # Ignorar comentarios
                if line_clean.startswith("'") or line_clean.startswith("/'"):
                    continue

                # Detectar inicio de bloques
                if any(
                    keyword in line_clean
                    for keyword in ["package ", "namespace ", "class ", "interface ", "enum "]
                ):
                    if "{" in line_clean:
                        block_stack.append(("block", i))

                # Detectar cierre de bloques
                if line_clean == "}":
                    if not block_stack:
                        return ValidationResult(
                            is_valid=False,
                            error_message="'}' sin bloque correspondiente",
                            error_line=i,
                        )
                    block_stack.pop()

            # Verificar que todos los bloques estén cerrados
            if block_stack:
                return ValidationResult(
                    is_valid=False,
                    error_message=f"{len(block_stack)} bloque(s) sin cerrar (falta '}}' )",
                )

            return ValidationResult(is_valid=True)

        except Exception as e:
            return ValidationResult(
                is_valid=False, error_message=f"Error al validar sintaxis: {str(e)}"
            )

    @staticmethod
    async def _kroki_verdict(diagram_type: str, code: str) -> ValidationResult:
        """Validate with the real renderer; valid when Kroki can't be reached.

        Used for D2, whose errors (unknown shapes, container-to-child
        connections…) a structural check can't see.
        """
        from app.core.config import settings

        from .kroki_client import KrokiClient, KrokiRenderError, KrokiTimeoutError

        try:
            await KrokiClient(base_url=settings.KROKI_URL, timeout=15.0).render(diagram_type, code)
            return ValidationResult(is_valid=True, error_message=None, error_line=None)
        except KrokiRenderError as error:
            if error.status_code != 400:
                return ValidationResult(is_valid=True, error_message=None, error_line=None)
            message = error.detail.removeprefix("Error 400: ").strip().splitlines()[0][:300]
            return ValidationResult(is_valid=False, error_message=message, error_line=None)
        except KrokiTimeoutError:
            return ValidationResult(is_valid=True, error_message=None, error_line=None)

    @staticmethod
    async def validate_d2(code: str) -> ValidationResult:
        """
        Validar sintaxis estructural básica de código D2.

        Realiza validación estructural: verifica que el código no esté vacío
        y que las llaves { } estén balanceadas.

        Args:
            code: Código del diagrama D2

        Returns:
            ValidationResult con resultado de validación
        """
        try:
            # Verificar código vacío
            if not code or not code.strip():
                return ValidationResult(
                    is_valid=False,
                    error_message="El código del diagrama está vacío",
                )

            # Verificar balance de llaves { }
            brace_depth = 0
            lines = code.split("\n")
            for i, line in enumerate(lines, start=1):
                # Ignorar comentarios (líneas que comienzan con #)
                line_stripped = line.strip()
                if line_stripped.startswith("#"):
                    continue

                # Remover contenido dentro de strings para no contar llaves en strings
                line_no_strings = re.sub(r'"[^"]*"', "", line_stripped)

                # Remover comentarios inline
                comment_pos = line_no_strings.find("#")
                if comment_pos >= 0:
                    line_no_strings = line_no_strings[:comment_pos]

                for char in line_no_strings:
                    if char == "{":
                        brace_depth += 1
                    elif char == "}":
                        brace_depth -= 1
                        if brace_depth < 0:
                            return ValidationResult(
                                is_valid=False,
                                error_message="'}' sin '{' correspondiente",
                                error_line=i,
                            )

            if brace_depth > 0:
                return ValidationResult(
                    is_valid=False,
                    error_message=f"{brace_depth} llave(s) '{{' sin cerrar (falta '}}' )",
                )

            # Structure looks fine: ask the real renderer (shapes, connections,
            # keys). Unreachable Kroki keeps the structural verdict.
            return await SyntaxValidator._kroki_verdict("d2", code)

        except Exception as e:
            return ValidationResult(
                is_valid=False,
                error_message=f"Error al validar sintaxis: {str(e)}",
            )

    @staticmethod
    async def validate_dbml(code: str) -> ValidationResult:
        """
        Validar sintaxis estructural básica de código DBML.

        Realiza validación estructural: verifica que el código no esté vacío,
        que contenga al menos una definición Table/Enum/Ref, que las llaves
        estén balanceadas, y que las definiciones de tablas y relaciones
        sigan el formato básico esperado.

        Args:
            code: Código del diagrama DBML

        Returns:
            ValidationResult con resultado de validación
        """
        try:
            # Verificar código vacío
            if not code or not code.strip():
                return ValidationResult(
                    is_valid=False,
                    error_message="El código del diagrama está vacío",
                )

            lines = code.split("\n")

            # Verificar balance de llaves { }
            brace_depth = 0
            for i, line in enumerate(lines, start=1):
                line_stripped = line.strip()

                # Ignorar comentarios de línea completa
                if line_stripped.startswith("//"):
                    continue

                # Remover contenido dentro de strings para no contar llaves en strings
                line_no_strings = re.sub(r"'[^']*'", "", line_stripped)
                line_no_strings = re.sub(r'"[^"]*"', "", line_no_strings)

                # Remover comentarios inline
                comment_pos = line_no_strings.find("//")
                if comment_pos >= 0:
                    line_no_strings = line_no_strings[:comment_pos]

                for char in line_no_strings:
                    if char == "{":
                        brace_depth += 1
                    elif char == "}":
                        brace_depth -= 1
                        if brace_depth < 0:
                            return ValidationResult(
                                is_valid=False,
                                error_message="'}' sin '{' correspondiente",
                                error_line=i,
                            )

            if brace_depth > 0:
                return ValidationResult(
                    is_valid=False,
                    error_message=f"{brace_depth} llave(s) '{{' sin cerrar (falta '}}' )",
                )

            # Verificar presencia de al menos una definición Table, Enum o Ref
            has_table = bool(re.search(r"\bTable\b\s+\w+", code, re.IGNORECASE))
            has_enum = bool(re.search(r"\bEnum\b\s+\w+", code, re.IGNORECASE))
            has_ref = bool(re.search(r"\bRef\b\s*[:{]", code, re.IGNORECASE))
            # También detectar refs inline dentro de columnas: [ref: > table.col]
            has_inline_ref = bool(re.search(r"\[\s*ref\s*:", code, re.IGNORECASE))

            if not (has_table or has_enum or has_ref or has_inline_ref):
                return ValidationResult(
                    is_valid=False,
                    error_message=(
                        "El código DBML debe contener al menos una definición "
                        "de Table, Enum o Ref"
                    ),
                )

            # Validar formato básico de definiciones de tabla: Table name { ... }
            table_keyword_lines = [
                (i, line)
                for i, line in enumerate(lines, start=1)
                if re.match(r"\s*Table\b", line, re.IGNORECASE)
            ]
            for line_num, line in table_keyword_lines:
                line_clean = line.strip()
                # Ignorar comentarios
                if line_clean.startswith("//"):
                    continue
                # Verificar que la línea con Table siga el formato esperado
                if not re.match(
                    r"Table\s+\w+(\.\w+)?\s*(as\s+\w+\s*)?\{?\s*(//.*)?$",
                    line_clean,
                    re.IGNORECASE,
                ):
                    return ValidationResult(
                        is_valid=False,
                        error_message=(
                            f"Formato de tabla inválido en línea {line_num}. "
                            "Formato esperado: 'Table nombre {{...}}'"
                        ),
                        error_line=line_num,
                    )

            # Validar formato básico de relaciones standalone: Ref: table1.col > table2.col
            ref_lines = [
                (i, line)
                for i, line in enumerate(lines, start=1)
                if re.match(r"\s*Ref\b", line, re.IGNORECASE)
            ]
            for line_num, line in ref_lines:
                line_clean = line.strip()
                # Ignorar comentarios
                if line_clean.startswith("//"):
                    continue
                # Ref con bloque: Ref name { ... } — solo verificar apertura
                if re.match(r"Ref\s*(\w+\s*)?\{", line_clean, re.IGNORECASE):
                    continue
                # Ref inline: Ref: table1.col > table2.col (o <, -, <>)
                if re.match(
                    r"Ref\s*(\w+\s*)?:\s*\w+(\.\w+)+\s*[<>\-]+\s*\w+(\.\w+)+",
                    line_clean,
                    re.IGNORECASE,
                ):
                    continue
                # Si no coincide con ningún formato válido
                return ValidationResult(
                    is_valid=False,
                    error_message=(
                        f"Formato de relación inválido en línea {line_num}. "
                        "Formato esperado: 'Ref: tabla1.col > tabla2.col' o 'Ref nombre {{...}}'"
                    ),
                    error_line=line_num,
                )

            return ValidationResult(is_valid=True)

        except Exception as e:
            return ValidationResult(
                is_valid=False,
                error_message=f"Error al validar sintaxis: {str(e)}",
            )

    @staticmethod
    async def validate(code: str, diagram_type: str) -> ValidationResult:
        """
        Validar sintaxis según tipo de diagrama.

        Args:
            code: Código del diagrama
            diagram_type: Tipo de diagrama ('mermaid', 'plantuml', 'd2' o 'dbml')

        Returns:
            ValidationResult con resultado de validación
        """
        diagram_type_lower = diagram_type.lower()

        if "mermaid" in diagram_type_lower or diagram_type_lower in [
            "flowchart",
            "sequence",
            "class",
            "state",
            "er",
            "gantt",
            "pie",
            "journey",
        ]:
            return await SyntaxValidator.validate_mermaid(code)
        elif "plantuml" in diagram_type_lower or diagram_type_lower == "uml":
            return await SyntaxValidator.validate_plantuml(code)
        elif "d2" in diagram_type_lower:
            return await SyntaxValidator.validate_d2(code)
        elif "dbml" in diagram_type_lower:
            return await SyntaxValidator.validate_dbml(code)
        else:
            # Por defecto, intentar validar como Mermaid
            return await SyntaxValidator.validate_mermaid(code)

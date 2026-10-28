"""Validate the full AST, including CTE bodies and functions, before execution."""
import sqlglot
from sqlglot import exp

# Closed function list: SELECT itself does not make volatile functions safe.
FUNCTIONS = set("""COUNT SUM AVG MIN MAX ROUND COALESCE NULLIF CAST TRY_CAST CASE IF DATE_TRUNC
TIMESTAMP_TRUNC EXTRACT DATE_PART TO_CHAR TO_DATE TO_TIMESTAMP GENERATE_SERIES
PERCENTILE_CONT PERCENTILE_DISC ABS CEIL FLOOR POWER SQRT GREATEST LEAST
LOWER UPPER TRIM LENGTH CHAR_LENGTH SUBSTRING LEFT RIGHT REPLACE CONCAT CONCAT_WS
STRING_AGG ARRAY_AGG JSON_AGG JSONB_AGG JSON_BUILD_OBJECT JSONB_BUILD_OBJECT
JSON_OBJECT JSONB_OBJECT_AGG ROW_NUMBER RANK DENSE_RANK LAG LEAD FIRST_VALUE LAST_VALUE
BOOL_AND BOOL_OR STDDEV STDDEV_POP STDDEV_SAMP VARIANCE VAR_POP VAR_SAMP
DATE TIME TS_OR_DS_TO_DATE DATE_ADD DATE_SUB INTERVAL REGEXP_REPLACE
ANONYMOUS ARRAY ARRAY_SIZE TIME_TO_STR STR_TO_TIME TRIM DATE_DIFF TIMESTAMP_DIFF
""".split())


def validate_sql(sql: str) -> str:
    try:
        statements = [s for s in sqlglot.parse(sql, read="postgres") if s is not None]
    except sqlglot.errors.ParseError as exc:
        raise ValueError("Некорректный PostgreSQL SELECT") from exc
    if len(statements) != 1 or not isinstance(statements[0], exp.Query):
        raise ValueError("Разрешён ровно один SELECT / WITH … SELECT")
    tree = statements[0]
    forbidden = (exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Command,
                 exp.Alter, exp.Copy, exp.Into, exp.Lock, exp.Transaction)
    if any(isinstance(node, forbidden) for node in tree.walk()):
        raise ValueError("Изменения данных и блокировки запрещены")
    ctes = {cte.alias for cte in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if table.catalog or not isinstance(table.this, exp.Identifier):
            raise ValueError("Внешние источники и табличные функции запрещены")
        if table.db not in {"core", "mart"} and not (not table.db and table.name in ctes):
            raise ValueError("Указывай таблицы явно в core или mart")
    for fn in tree.find_all(exp.Func):
        name = fn.name if isinstance(fn, exp.Anonymous) else fn.sql_name()
        if name.upper() not in FUNCTIONS - {"ANONYMOUS"}:
            raise ValueError(f"Функция {name} не разрешена для аналитического SQL")
        if isinstance(fn.parent, exp.Dot):
            raise ValueError("Функции с указанием схемы запрещены")
    return tree.sql(dialect="postgres")

import pytest
from backend.sql_guard import validate_sql


@pytest.mark.parametrize("sql", [
    "SELECT count(*) FROM core.orders",
    "WITH totals AS (SELECT order_id,sum(price) x FROM core.order_items GROUP BY 1) SELECT avg(x) FROM totals",
    "SELECT round(avg(score),2) FROM core.order_reviews",
    "SELECT extract(year FROM purchased_at), count(*) FROM core.orders GROUP BY 1",
    "SELECT sum(CASE WHEN status='delivered' THEN 1 ELSE 0 END) FROM core.orders",
])
def test_analytical_queries(sql):
    assert validate_sql(sql)


@pytest.mark.parametrize("sql", [
    "DELETE FROM core.orders", "SELECT 1; DROP SCHEMA core CASCADE",
    "WITH removed AS (DELETE FROM core.orders RETURNING *) SELECT * FROM removed",
    "SELECT * INTO core.copy FROM core.orders", "SELECT * FROM core.orders FOR UPDATE",
    "SELECT * FROM raw.orders", "SELECT * FROM pg_catalog.pg_authid", "SELECT * FROM orders",
    "SELECT pg_read_file('/etc/passwd')", "SELECT pg_sleep(20)",
    "SELECT pg_catalog.pg_read_file('/etc/passwd')", "SELECT set_config('search_path','raw',false)",
    "SELECT dblink('secret', 'SELECT 1')", "COPY core.orders TO '/tmp/orders'",
    "WITH a AS (SELECT pg_terminate_backend(1)) SELECT * FROM a",
])
def test_rejects_write_and_side_effects(sql):
    with pytest.raises(ValueError):
        validate_sql(sql)

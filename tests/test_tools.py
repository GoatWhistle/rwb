import json
import os
import pytest
from agents.tool_context import ToolContext as Invocation
from backend.tools import ToolContext, execute_sql, get_order
from backend.models import DashboardContext, Filters
from backend.database import db


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_sql_scope_and_reader_permissions():
    events=[]
    async def emit(name,payload): events.append((name,payload))
    arguments=json.dumps({'sql':'SELECT count(*) AS n FROM core.orders','apply_dashboard_filters':True})
    context=Invocation(context=ToolContext(DashboardContext(filters=Filters(states=['SP'])),emit),
        tool_name='execute_sql',tool_call_id='test',tool_arguments=arguments)
    result=await execute_sql.on_invoke_tool(context,arguments)
    assert result['table']['rows']==[{'n':41746}]
    assert result['parameters']=={'states':['SP']}
    permissions=(await db.query("""SELECT current_setting('transaction_read_only') AS ro,
      has_table_privilege(current_user,'core.orders','INSERT') AS can_insert,
      has_schema_privilege(current_user,'raw','USAGE') AS can_read_raw"""))['rows'][0]
    assert permissions=={'ro':'on','can_insert':False,'can_read_raw':False}


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_sql_result_is_bounded_and_unsafe_query_does_not_execute():
    async def emit(*args): pass
    for sql in ['SELECT order_id FROM core.orders',"SELECT pg_sleep(30)"]:
        arguments=json.dumps({'sql':sql,'apply_dashboard_filters':False})
        context=Invocation(context=ToolContext(None,emit),tool_name='execute_sql',tool_call_id='test',tool_arguments=arguments)
        result=await execute_sql.on_invoke_tool(context,arguments)
        if 'pg_sleep' in sql:
            assert 'error' in result
        else:
            assert result['table']['truncated'] is True
            assert len(result['table']['rows'])==500


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_order_card_keeps_independent_facts_and_missing_dates():
    async def emit(*args): pass
    for relation in ['order_items','order_payments','order_reviews']:
        order_id=(await db.query(f'SELECT order_id FROM core.{relation} GROUP BY 1 HAVING count(*)>1 LIMIT 1'))['rows'][0]['order_id']
        arguments=json.dumps({'order_id':order_id})
        context=Invocation(context=ToolContext(None,emit),tool_name='get_order',tool_call_id='test',tool_arguments=arguments)
        result=await get_order.on_invoke_tool(context,arguments)
        assert result['found']
        assert all(r['order_id']==order_id for r in result['items']['rows']+result['payments']['rows']+result['reviews']['rows'])
        from decimal import Decimal
        assert Decimal(result['totals']['rows'][0]['order_total']) == sum(Decimal(r['price'])+Decimal(r['freight_value']) for r in result['items']['rows'])
    order_id=(await db.query("SELECT order_id FROM core.orders WHERE status='delivered' AND delivered_at IS NULL LIMIT 1"))['rows'][0]['order_id']
    for order_id in [order_id,'unknown']:
        arguments=json.dumps({'order_id':order_id})
        context=Invocation(context=ToolContext(None,emit),tool_name='get_order',tool_call_id='test',tool_arguments=arguments)
        result=await get_order.on_invoke_tool(context,arguments)
        if order_id=='unknown': assert not result['found']
        else: assert result['order']['delivered_at'] is None


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_expensive_read_is_cancelled_by_database(monkeypatch):
    from backend.config import settings
    import psycopg
    monkeypatch.setattr(settings(),'sql_timeout_ms',5)
    with pytest.raises(psycopg.errors.QueryCanceled):
        await db.query('SELECT count(*) FROM core.order_items a CROSS JOIN core.order_items b')

import os
from decimal import Decimal
import pytest
from backend.metrics import query_metric
from backend.models import Filters


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_widget_and_group_use_identical_calculation():
    filters=Filters(states=['SP'])
    group=await query_metric('dashboard.kpi',filters)
    widget=await query_metric('dashboard.kpi.otd',filters)
    assert widget['table']['rows']==[{'otd':group['table']['rows'][0]['otd']}]
    assert widget['table']['rows'][0]['otd']==0.9551


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Set TEST_DATABASE=1 for local Olist database')
async def test_block_a_controls():
    async def rows(n): return (await query_metric('block_a.'+str(n),Filters()))['table']['rows']
    a1=await rows(1)
    assert len(a1)==24
    assert sum(Decimal(r['revenue']) for r in a1)==Decimal('13221498.11')
    assert next(r for r in a1 if r['month']=='2016-11-01')['orders_cnt']==0
    assert (await rows(2))[0]['revenue']=='226987.93'
    assert (await rows(3))[0]['avg_check']=='159.88'
    assert (await rows(4))[0]=={'customers_total':96096,'returned':2997,'returned_pct':'3.12'}
    a5=await rows(5)
    assert len(a5)==74
    assert sum(Decimal(r['revenue']) for r in a5)==Decimal('13221498.11')


@pytest.mark.skipif(os.environ.get('TEST_DATABASE')!='1',reason='Needs local Olist database')
async def test_filters_and_empty_months():
    data=await query_metric('block_a.1',Filters(start_date='2017-01-15',end_date='2017-03-01',states=['SP']))
    assert len(data['table']['rows'])==2
    assert data['filters']['states']==['SP']
    empty=await query_metric('block_a.1',Filters(start_date='2020-01-01',end_date='2020-03-01'))
    assert len(empty['table']['rows'])==2
    assert all(r['orders_cnt']==0 for r in empty['table']['rows'])

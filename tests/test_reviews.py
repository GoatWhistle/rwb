import pytest
from types import SimpleNamespace
from backend import reviews


async def test_embedding_dimension_rejected(monkeypatch):
    class Client:
        def __init__(self,**kw): self.embeddings=self
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def create(self,**kwargs):
            assert isinstance(kwargs['input'][0],str)
            return SimpleNamespace(data=[SimpleNamespace(index=0,embedding=[1.0,0.0])])
    monkeypatch.setattr(reviews,'AsyncOpenAI',Client)
    monkeypatch.setattr(reviews,'settings',lambda:SimpleNamespace(polza_api_key='test',embedding_base_url='http://test',embedding_model='test',embedding_dimensions=4096))
    with pytest.raises(ValueError,match='Размерность'):
        await reviews.embed(['text'])

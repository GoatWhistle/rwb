import asyncio
from pathlib import Path
import psycopg
from .config import settings


async def main():
    async with await psycopg.AsyncConnection.connect(settings().admin_database_url) as conn:
        await conn.execute((Path(__file__).parent / "bootstrap.sql").read_text())
    print("Agent reader role and ai schema ready.")


if __name__ == "__main__":
    asyncio.run(main())

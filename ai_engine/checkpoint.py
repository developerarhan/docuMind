import threading
from django.conf import settings
from psycopg import conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver


_pool = None
_checkpointer = None

_lock = threading.Lock()


def get_checkpointer():
    global _checkpointer, _pool

    if _checkpointer is None:
        with _lock:
            if _checkpointer is None:
                import sys
                db_settings = settings.DATABASES["default"]
                if "test" in sys.argv or db_settings.get("ENGINE") == "django.db.backends.sqlite3":
                    from langgraph.checkpoint.memory import MemorySaver
                    _checkpointer = MemorySaver()
                    return _checkpointer

                import os
                database_url = os.getenv("DATABASE_URL")
                if database_url:
                    connection_string = database_url
                    if "sslmode=" not in connection_string:
                        separator = "&" if "?" in connection_string else "?"
                        connection_string = f"{connection_string}{separator}sslmode=require"
                else:
                    connection_string = conninfo.make_conninfo(
                        host=db_settings.get("HOST", "localhost"),
                        port=db_settings.get("PORT", 5432),
                        dbname=db_settings["NAME"],
                        user=db_settings["USER"],
                        password=db_settings["PASSWORD"],
                    )

                _pool = ConnectionPool(
                    conninfo=connection_string,
                    min_size=1,
                    max_size=10,
                    kwargs={
                        "autocommit": True,
                        "row_factory": dict_row,
                    },
                )

                try:

                    _checkpointer = PostgresSaver(_pool)
                    _checkpointer.setup()

                except Exception:
                    # Clean up pool if initialization fails
                    _pool.close()
                    _pool = None
                    _checkpointer = None
                    raise

    return _checkpointer

def close_checkpointer():
    global _pool, _checkpointer

    with _lock:
        if _pool is not None:
            _pool.close()
            _pool = None
            _checkpointer = None

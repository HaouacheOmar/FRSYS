from FRSYS.settings import *  # noqa: F401,F403

# Tests run on in-memory SQLite so they don't need Postgres.
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}

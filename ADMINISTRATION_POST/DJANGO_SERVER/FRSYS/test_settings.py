import os

# Tests never need a real key; settings refuse short/placeholder keys outside DEBUG.
os.environ['SECRET_KEY'] = 'test-only-secret-key-not-used-anywhere-else-0123456789'

from FRSYS.settings import *  # noqa: E402,F401,F403

# Tests run on in-memory SQLite so they don't need Postgres.
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}

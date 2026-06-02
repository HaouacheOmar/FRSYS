
from pathlib import Path
import importlib.util
import os
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    value = os.getenv(name, str(default))
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


SECRET_KEY = os.getenv('SECRET_KEY', '').strip()
if not SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY is not set. Add it to DJANGO_SERVER/.env')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env_bool('DEBUG', False)

ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', '*').split(',') if host.strip()]


# CORS settings for React frontend and WebSocket
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if origin.strip()]
CSRF_COOKIE_SECURE = env_bool('CSRF_COOKIE_SECURE', False)


# Application definition

INSTALLED_APPS = [
    'daphne',  
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',  
    'channels', 
    'server',   
    'rest_framework',  
    'django_filters',  
    'rest_framework_simplejwt.token_blacklist',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', 
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'FRSYS.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'server' / 'templates'],  # Add server templates
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'FRSYS.wsgi.application'

# ASGI Application for WebSocket support
ASGI_APPLICATION = 'FRSYS.routing.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    }
}

# Enable Redis layer only when explicitly requested and package is available.
if os.getenv('USE_REDIS_CHANNEL_LAYER', '0') == '1':
    if importlib.util.find_spec('channels_redis') is not None:
        CHANNEL_LAYERS = {
            'default': {
                'BACKEND': 'channels_redis.core.RedisChannelLayer',
                'CONFIG': {
                    'hosts': [('127.0.0.1', 6379)],
                },
            },
        }


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE':'django.db.backends.postgresql',
        'NAME':os.getenv('DB_NAME', '').strip(),
        'USER':os.getenv('DB_USER', '').strip(),
        'PASSWORD':os.getenv('DB_PASSWORD', '').strip(),
        'HOST':os.getenv('DB_HOST', 'db').strip(),
        'PORT':os.getenv('DB_PORT', '').strip(),
    }
}


USE_I18N = True



# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'


USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'


# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'






# Keep CORS narrow by default; allow all only when explicitly set.
CORS_ALLOW_ALL_ORIGINS = env_bool('CORS_ALLOW_ALL_ORIGINS', False)

# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'server.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
}

AUTH_COOKIE_SECURE = env_bool('AUTH_COOKIE_SECURE', False)
AUTH_COOKIE_SAMESITE = os.getenv('AUTH_COOKIE_SAMESITE', 'Lax').strip() or 'Lax'
AUTH_COOKIE_DOMAIN = os.getenv('AUTH_COOKIE_DOMAIN', '').strip() or None
AUTH_ACCESS_COOKIE_AGE = int(os.getenv('AUTH_ACCESS_COOKIE_AGE', '900'))
AUTH_REFRESH_COOKIE_AGE = int(os.getenv('AUTH_REFRESH_COOKIE_AGE', '604800'))
CAMERA_CREDENTIALS_KEY = os.getenv('CAMERA_CREDENTIALS_KEY', '').strip()

AUTH_LOGIN_MAX_ATTEMPTS = int(os.getenv('AUTH_LOGIN_MAX_ATTEMPTS', '5'))
AUTH_LOGIN_LOCK_MINUTES = int(os.getenv('AUTH_LOGIN_LOCK_MINUTES', '15'))

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle',
    'rest_framework.throttling.ScopedRateThrottle',
]

REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': os.getenv('THROTTLE_ANON', '120/hour').strip(),
    'user': os.getenv('THROTTLE_USER', '1500/hour').strip(),
    'auth_login': os.getenv('THROTTLE_AUTH_LOGIN', '20/hour').strip(),
    'auth_refresh': os.getenv('THROTTLE_AUTH_REFRESH', '60/hour').strip(),
    'auth_register': os.getenv('THROTTLE_AUTH_REGISTER', '25/hour').strip(),
    'auth_grant_token': os.getenv('THROTTLE_AUTH_GRANT_TOKEN', '50/hour').strip(),
    'auth_role_grant': os.getenv('THROTTLE_AUTH_ROLE_GRANT', '80/hour').strip(),
    'auth_guest_manage': os.getenv('THROTTLE_AUTH_GUEST_MANAGE', '200/hour').strip(),
}
PHOTOS_BASE_DIR='/data/faces'
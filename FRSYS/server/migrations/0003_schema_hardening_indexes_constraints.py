from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0002_update_rentree_fields'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='compagnie',
            options={'ordering': ['label']},
        ),
        migrations.AlterModelOptions(
            name='person',
            options={'ordering': ['nom', 'prenom', 'mat']},
        ),
        migrations.AlterModelOptions(
            name='rentree',
            options={'ordering': ['-date_rentree']},
        ),
        migrations.AlterModelOptions(
            name='spectacle',
            options={'ordering': ['-date_sortie']},
        ),
        migrations.AlterField(
            model_name='camera',
            name='is_active',
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AlterField(
            model_name='compagnie',
            name='label',
            field=models.CharField(db_index=True, max_length=150),
        ),
        migrations.AlterField(
            model_name='spectacle',
            name='person',
            field=models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='spectacles', to='server.person'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['compagnie', 'nom', 'prenom'], name='idx_person_comp_nom_pre'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['nom', 'prenom'], name='idx_person_nom_pre'),
        ),
        migrations.AddIndex(
            model_name='rentree',
            index=models.Index(fields=['est_retard', 'date_rentree'], name='idx_rent_late_date'),
        ),
        migrations.AddIndex(
            model_name='rentree',
            index=models.Index(fields=['person', 'date_rentree'], name='idx_rent_person_date'),
        ),
        migrations.AddIndex(
            model_name='spectacle',
            index=models.Index(fields=['person', 'date_rentree'], name='idx_spec_person_open'),
        ),
        migrations.AddIndex(
            model_name='spectacle',
            index=models.Index(fields=['date_sortie'], name='idx_spec_sortie'),
        ),
        migrations.AddIndex(
            model_name='spectacle',
            index=models.Index(fields=['date_rentree'], name='idx_spec_rentree'),
        ),
        migrations.AddIndex(
            model_name='spectacle',
            index=models.Index(fields=['date_limite_retour'], name='idx_spec_limite'),
        ),
        migrations.AddConstraint(
            model_name='spectacle',
            constraint=models.CheckConstraint(
                condition=Q(date_rentree__isnull=True) | Q(date_rentree__gte=F('date_sortie')),
                name='chk_spec_rentree_after_sortie',
            ),
        ),
        migrations.AddConstraint(
            model_name='spectacle',
            constraint=models.CheckConstraint(
                condition=Q(date_limite_retour__isnull=True) | Q(date_limite_retour__gte=F('date_sortie')),
                name='chk_spec_limite_after_sortie',
            ),
        ),
    ]

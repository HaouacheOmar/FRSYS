from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='rentree',
            old_name='date_sortie',
            new_name='date_rentree',
        ),
        migrations.AlterField(
            model_name='rentree',
            name='spectacle',
            field=models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='rentree', to='server.spectacle'),
        ),
    ]

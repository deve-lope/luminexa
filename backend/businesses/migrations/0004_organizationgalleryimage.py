from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0003_businesstype_organization_business_types'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationGalleryImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='orgs/gallery/')),
                ('caption', models.CharField(blank=True, max_length=200)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='gallery_images', to='businesses.organization')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]

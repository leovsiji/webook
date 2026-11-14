from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Photo


@receiver(post_delete, sender=Photo)
def delete_photo_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
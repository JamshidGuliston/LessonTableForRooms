"""Yuklangan rasmni planshet uchun kichraytirish: eski planshetda 2 GB RAM, rasm yengil bo'lsin."""
from io import BytesIO
from pathlib import PurePath

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_SIDE = 800


def shrink(upload):
    """Uzun tomoni MAX_SIDE dan oshmaydigan JPEG (shaffof bo'lsa PNG) ContentFile qaytaradi."""
    if upload.size > MAX_UPLOAD_BYTES:
        raise serializers.ValidationError('Rasm 8 MB dan katta bo\'lmasin.')
    try:
        img = Image.open(upload)
        img = ImageOps.exif_transpose(img)  # telefonda olingan rasm yonboshlab qolmasin
    except (UnidentifiedImageError, OSError):
        raise serializers.ValidationError('Bu rasm fayli emas (JPG yoki PNG yuklang).')
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = BytesIO()
    stem = PurePath(upload.name).stem or 'rasm'
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        img.save(out, 'PNG', optimize=True)
        return ContentFile(out.getvalue(), name=f'{stem}.png')
    img.convert('RGB').save(out, 'JPEG', quality=85, optimize=True)
    return ContentFile(out.getvalue(), name=f'{stem}.jpg')


class ImageUploadField(serializers.ImageField):
    """Yuklashda kichraytiradi; javobda nisbiy URL (/media/...) — planshet server manzilini o'zi qo'shadi.
    null yuborilsa rasm olib tashlanadi."""

    def __init__(self, **kwargs):
        kwargs.setdefault('required', False)
        kwargs.setdefault('allow_null', True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return shrink(super().to_internal_value(data))

    def to_representation(self, value):
        return value.url if value else None


def delete_replaced(instance, field, old_name):
    """Rasm almashtirilgan/olib tashlangan bo'lsa eski faylni diskdan o'chiradi."""
    new = getattr(instance, field)
    if old_name and old_name != (new.name if new else ''):
        new.storage.delete(old_name)

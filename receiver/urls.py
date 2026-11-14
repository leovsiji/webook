
from django.urls import path
from . import views

app_name = "receiver"

urlpatterns = [
    path("publish/<int:book_id>/", views.publish_book, name="publish"),
    path("<slug:slug>/", views.unlock_book, name="unlock"),
    path("<slug:slug>/read/", views.read_book, name="read"),
]

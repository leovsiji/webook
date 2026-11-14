from django.urls import path
from .views import (
    create_book, create_page, book_pages,
    delete_page, edit_page, delete_book, edit_book,
    register, user_login, my_books, add_photo,
    delete_photo
)

urlpatterns = [
    path("register/", register, name="register"),
    path("create-book/", create_book, name="create_book"),
    path("book/<int:book_id>/page/create/", create_page, name="create_page"),
    path("book/<int:book_id>/pages/", book_pages, name="book_pages"),
    path("page/<int:page_id>/delete/", delete_page, name="delete_page"),
    path("page/<int:page_id>/edit/", edit_page, name="edit_page"),
    path("book/<int:book_id>/delete/", delete_book, name="delete_book"),
    path("book/<int:book_id>/edit/", edit_book, name="edit_book"),
    path("login/", user_login, name="login"),
    path("my-books/", my_books, name="my_books"),
    path("page/<int:page_id>/photo/add/", add_photo, name="add_photo"),
    path("photo/<int:photo_id>/delete/", delete_photo, name="delete_photo"),
]
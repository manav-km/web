"""api/v1/blog.py"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.request_utils import get_client_ip
from app.core.security import CurrentUser, require_admin
from app.db import blog as db
from app.models.content import BlogPostIn, BlogPostOut
from app.services import audit

router = APIRouter(prefix="/api/v1/blog", tags=["blog"])


@router.get("")
def list_posts(category: str | None = None):
    return db.list_published(category)


@router.get("/{slug}", response_model=BlogPostOut)
def get_post(slug: str):
    post = db.get_by_slug_published(slug)
    if not post:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return post


@router.get("/admin/all", response_model=list[BlogPostOut])
def list_posts_admin(_: CurrentUser = Depends(require_admin)):
    return db.list_all_admin()


@router.post("/admin", response_model=BlogPostOut, status_code=status.HTTP_201_CREATED)
async def create_post(payload: BlogPostIn, request: Request, user: CurrentUser = Depends(require_admin)):
    created = db.create(payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="blog_post_created", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"post_id": created["id"], "slug": created["slug"]},
    )
    return created


@router.put("/admin/{post_id}", response_model=BlogPostOut)
async def update_post(post_id: str, payload: BlogPostIn, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(post_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    updated = db.update(post_id, payload.model_dump(mode="json"))
    await audit.log_event(
        category="content", action="blog_post_updated", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"post_id": post_id},
    )
    return updated


@router.delete("/admin/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: str, request: Request, user: CurrentUser = Depends(require_admin)):
    if not db.get(post_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    db.delete(post_id)
    await audit.log_event(
        category="content", action="blog_post_deleted", ip_address=get_client_ip(request),
        performer_uid=user.uid, metadata={"post_id": post_id}, severity="Alert",
    )

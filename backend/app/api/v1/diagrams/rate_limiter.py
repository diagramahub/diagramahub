"""Rate limiting for the public diagram rendering endpoint.

``POST /diagrams/render`` needs no authentication and triggers a server-side
render (Kroki), so it is bounded per IP to keep a single client from saturating
the renderer.
"""
from app.core.rate_limit import SlidingWindowRateLimiter

# 60 renders per IP per minute: enough to open a project holding many
# server-side diagrams at once, still a hard ceiling for scripted abuse.
render_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60)

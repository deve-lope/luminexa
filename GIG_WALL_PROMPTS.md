# Gig Wall Task Prompts

Copy these prompts to low-power models or subagents. Each is self-contained.

---

## SLICE 1: Customer Post Creation

### Task 1.1: Create GigPost model

**File:** `backend/jobs/models.py`

**Prompt:**
```
Add a new Django model called GigPost to backend/jobs/models.py after the existing models.

Requirements:
- Import: from django.core.validators import MinValueValidator
- Fields:
  * customer: ForeignKey to settings.AUTH_USER_MODEL, on_delete=CASCADE, related_name='gig_posts'
  * title: CharField, max_length=200
  * description: TextField, max_length=2000
  * category: ForeignKey to BusinessType, on_delete=PROTECT, related_name='gig_posts', null=True, blank=True
  * location_address: TextField, blank=True, default=''
  * location_city: CharField, max_length=120, blank=True, default='', db_index=True
  * location_state: CharField, max_length=80, blank=True, default='', db_index=True
  * location_postal_code: CharField, max_length=12, blank=True, default='', db_index=True
  * location_latitude: DecimalField, max_digits=9, decimal_places=6, null=True, blank=True
  * location_longitude: DecimalField, max_digits=9, decimal_places=6, null=True, blank=True
  * search_radius_miles: DecimalField, max_digits=5, decimal_places=1, default=25
  * status: CharField, max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
  * expires_at: DateTimeField
  * created_at: DateTimeField, auto_now_add=True
  * updated_at: DateTimeField, auto_now=True

- Create Status TextChoices nested class with: OPEN='open', QUOTED='quoted', ACCEPTED='accepted', CLOSED='closed'

- Meta class:
  * ordering = ['-created_at']
  * indexes = [
      models.Index(fields=['status', '-created_at']),
      models.Index(fields=['category', 'status', '-created_at']),
      models.Index(fields=['location_latitude', 'location_longitude']),
    ]

- __str__ method: return f'{self.customer_id}: {self.title[:50]}'

Place this model right before the existing Task model.
```

---

### Task 1.2: Create GigPostImage model

**File:** `backend/jobs/models.py`

**Prompt:**
```
Add a new Django model called GigPostImage to backend/jobs/models.py right after the GigPost model you just created.

Requirements:
- Add constants at class level:
  * MAX_PER_POST = 2
  * MAX_BYTES = 5 * 1024 * 1024  # 5MB

- Fields:
  * gig_post: ForeignKey to GigPost, on_delete=CASCADE, related_name='images'
  * image: ImageField, upload_to='gigs/images/%Y/%m/'
  * sort_order: PositiveIntegerField, default=0
  * created_at: DateTimeField, auto_now_add=True

- Meta class:
  * ordering = ['sort_order', 'id']

- __str__ method: return f'GigPost {self.gig_post_id} image #{self.pk}'
```

---

### Task 2.3: Create geocoding helper for gig posts

**File:** `backend/jobs/gig_geocode.py` (NEW FILE)

**Prompt:**
```
Create a new file backend/jobs/gig_geocode.py with geocoding logic for gig posts.

Copy the pattern from backend/businesses/location.py function assign_org_coordinates.

Requirements:
- Import: from businesses.geocode import resolve_coordinates
- Import: from businesses.location import quantize_coordinate
- Import: from .models import GigPost

Create function:
def assign_gig_coordinates(gig_post: GigPost, *, save: bool = True) -> bool:
    """Geocode gig post location and store lat/lng. Returns True if successful."""
    # Extract postal from gig_post.location_postal_code (strip and check length >= 3)
    # Call resolve_coordinates(postal, city=gig_post.location_city, state=gig_post.location_state)
    # If coords found, set gig_post.location_latitude and location_longitude using quantize_coordinate
    # If save=True, call gig_post.save(update_fields=['location_latitude', 'location_longitude', 'updated_at'])
    # Return True if coords found, False otherwise

Follow the exact pattern from assign_org_coordinates in businesses/location.py.
```

---

### Task 3.1: Create GigPostImage serializer

**File:** `backend/jobs/serializers.py` (or create `gig_serializers.py`)

**Prompt:**
```
Add a serializer for GigPostImage to backend/jobs/serializers.py (or create new file backend/jobs/gig_serializers.py if you prefer).

Requirements:
- Import: from rest_framework import serializers
- Import: from .models import GigPostImage

Create GigPostImageSerializer(serializers.ModelSerializer):
- Meta:
  * model = GigPostImage
  * fields = ['id', 'image', 'sort_order', 'created_at']
  * read_only_fields = ['id', 'created_at']

- Add validate_image method:
  * Check file size <= GigPostImage.MAX_BYTES (5MB)
  * Check file extension in ['.jpg', '.jpeg', '.png', '.webp']
  * Raise ValidationError if either check fails

Example validation:
def validate_image(self, value):
    if value.size > GigPostImage.MAX_BYTES:
        raise serializers.ValidationError(
            f"Image file too large. Max size is {GigPostImage.MAX_BYTES / (1024*1024):.0f}MB."
        )
    # Check extension...
    return value
```

---

### Task 3.2: Create GigPost list/detail serializer

**File:** Same as Task 3.1

**Prompt:**
```
Add GigPostSerializer to the same file as Task 3.1.

Requirements:
- Import: from .models import GigPost, BusinessType

Create GigPostSerializer(serializers.ModelSerializer):
- Meta:
  * model = GigPost
  * fields = ['id', 'customer', 'customer_name', 'title', 'description', 'category', 
              'category_name', 'location_address', 'location_city', 'location_state', 
              'location_postal_code', 'location_latitude', 'location_longitude', 
              'search_radius_miles', 'status', 'expires_at', 'created_at', 'updated_at',
              'images', 'quote_count']
  * read_only_fields = ['id', 'customer', 'created_at', 'updated_at', 'status']

- Add fields:
  * images = GigPostImageSerializer(many=True, read_only=True)
  * customer_name = serializers.CharField(source='customer.full_name', read_only=True)
  * category_name = serializers.CharField(source='category.name', read_only=True)
  * quote_count = serializers.SerializerMethodField()

- Method get_quote_count(self, obj):
    return obj.quotes.filter(status='submitted').count() if hasattr(obj, 'quotes') else 0
```

---

### Task 3.3: Create GigPost write serializer

**File:** Same as Task 3.1

**Prompt:**
```
Add GigPostWriteSerializer to the same file.

Requirements:
- Import: from django.utils import timezone
- Import: from datetime import timedelta

Create GigPostWriteSerializer(serializers.ModelSerializer):
- Meta:
  * model = GigPost
  * fields = ['title', 'description', 'category', 'location_address', 'location_city',
              'location_state', 'location_postal_code', 'search_radius_miles']

- Validate:
  * title: max 200 chars (already enforced by model)
  * description: max 2000 chars (already enforced)
  * search_radius_miles: between 1 and 100
  * category: must be an active BusinessType

- Override create(self, validated_data):
  * Set customer = self.context['request'].user
  * Set expires_at = timezone.now() + timedelta(days=30)
  * Call obj = GigPost.objects.create(**validated_data, customer=..., expires_at=...)
  * Import assign_gig_coordinates from jobs.gig_geocode
  * Call assign_gig_coordinates(obj, save=True) to geocode
  * Return obj

Add validate_search_radius_miles:
def validate_search_radius_miles(self, value):
    if value < 1 or value > 100:
        raise serializers.ValidationError("Radius must be between 1 and 100 miles.")
    return value
```

---

### Task 1.5: Generate and test migration

**Prompt:**
```
Run these commands in the backend directory:

1. Generate migration:
   cd backend
   .venv/bin/python manage.py makemigrations jobs

2. Review the migration file in backend/jobs/migrations/
   Should create GigPost and GigPostImage models

3. Apply migration:
   .venv/bin/python manage.py migrate

4. Test in Django shell:
   .venv/bin/python manage.py shell

   from jobs.models import GigPost
   from accounts.models import User
   from businesses.models import BusinessType
   from django.utils import timezone
   from datetime import timedelta
   
   user = User.objects.first()
   cat = BusinessType.objects.first()
   
   post = GigPost.objects.create(
       customer=user,
       title="Need plumbing help",
       description="Leaky faucet in kitchen",
       category=cat,
       location_city="Toronto",
       location_state="ON",
       location_postal_code="M5V",
       expires_at=timezone.now() + timedelta(days=30)
   )
   
   print(f"Created: {post}")
   print(f"Status: {post.status}")

If this runs without errors, Task 1.5 is complete.
```

---

### Task 4.1: Create customer gig list/create view

**File:** `backend/jobs/gig_views.py` (NEW FILE)

**Prompt:**
```
Create a new file backend/jobs/gig_views.py with a ViewSet for customer gig posts.

Requirements:
- Imports:
  from rest_framework import viewsets, permissions, status
  from rest_framework.response import Response
  from .models import GigPost
  from .serializers import GigPostSerializer, GigPostWriteSerializer  # or gig_serializers if separate
  
Create CustomerGigPostViewSet(viewsets.ModelViewSet):
- queryset = GigPost.objects.all()
- permission_classes = [permissions.IsAuthenticated]
- pagination_class: set to 20 items per page

- Override get_queryset(self):
  Return GigPost.objects.filter(customer=self.request.user).order_by('-created_at')
  
- Override get_serializer_class(self):
  if self.action in ['create', 'update', 'partial_update']:
      return GigPostWriteSerializer
  return GigPostSerializer

- Override perform_create(self, serializer):
  serializer.save(customer=self.request.user)

Only implement list and create actions for now. We'll add detail/update/delete later.
```

---

### Task 5.2: Create GigImageUpload component

**File:** `frontend/src/components/gigs/GigImageUpload.js` (NEW FILE)

**Prompt:**
```
Create a React component for uploading gig post images.

Requirements:
- Component: GigImageUpload
- Props:
  * images: array of image objects (with id, image URL)
  * onAdd: function(file) - called when user selects a file
  * onRemove: function(imageId) - called to remove an image
  * maxImages: number (default 2)
  * disabled: boolean

Features:
- Show file input (accept .jpg,.jpeg,.png,.webp)
- Display thumbnail previews of uploaded images
- Show "Add Image" button (disabled if images.length >= maxImages)
- Each thumbnail has a remove button (X icon)
- Validate: max 5MB per file, show error message below input
- Show count: "2/2 images" or "0/2 images"

Style:
- Use Tailwind classes or match existing Luminexa button/input styles
- Thumbnails in a horizontal row
- 100x100px thumbnail size with object-cover

Return JSX with:
<div className="gig-image-upload">
  <div className="thumbnails">
    {/* Map images to thumbnails with remove button */}
  </div>
  <input type="file" onChange={handleFileSelect} disabled={...} />
  <button onClick={triggerFileInput} disabled={...}>Add Image ({images.length}/{maxImages})</button>
  {error && <p className="error">{error}</p>}
</div>
```

---

### Task 6.1: Create CreateGigPostPage

**File:** `frontend/src/pages/gigs/CreateGigPostPage.js` (NEW FILE)

**Prompt:**
```
Create a React page for customers to create a gig post.

Requirements:
- Import: useState, useEffect
- Import: useNavigate from react-router-dom
- Import: api from utils/api (or your API client)
- Import: GigImageUpload from components/gigs/GigImageUpload

State:
- formData: { title, description, category, location_address, location_city, location_state, location_postal_code, search_radius_miles: 25 }
- categories: [] (fetch from /api/businesses/types/)
- images: []
- loading: false
- errors: {}

Functions:
- fetchCategories(): GET /api/businesses/types/
- handleSubmit(): POST /api/jobs/gigs/ with formData, then POST images to /api/jobs/gigs/<id>/images/
- handleImageAdd(file): add to images array (local preview)
- handleImageRemove(idx): remove from images array

Form fields:
1. Title input (text, required)
2. Description textarea (required, max 2000 chars, show char count)
3. Category dropdown (select from categories)
4. Location inputs: address, city, state, postal code (all required)
5. Radius slider (1-100 miles, default 25, show value)
6. GigImageUpload component (max 2 images)
7. Submit button

On success:
- Navigate to /gigs/my-posts
- Show success toast/message

Handle errors:
- Display field-specific errors from API response
- Show general error message

Layout:
- Full page with header "Create Gig Post"
- Form in a card/container
- Match existing Luminexa page styles
```

---

## SLICE 2: Provider Visibility & Browse

### Task 1.3: Create GigComment model

**File:** `backend/jobs/models.py`

**Prompt:**
```
Add GigComment model to backend/jobs/models.py right after GigPostImage.

Requirements:
- Fields:
  * gig_post: ForeignKey to GigPost, on_delete=CASCADE, related_name='comments'
  * author: ForeignKey to settings.AUTH_USER_MODEL, on_delete=CASCADE, related_name='gig_comments'
  * organization: ForeignKey to Organization, on_delete=SET_NULL, null=True, blank=True, related_name='gig_comments'
    (Set if author is provider staff/owner)
  * body: TextField, max_length=1000
  * created_at: DateTimeField, auto_now_add=True

- Meta:
  * ordering = ['created_at']
  * indexes = [models.Index(fields=['gig_post', 'created_at'])]

- __str__: return f'Comment on GigPost {self.gig_post_id} by {self.author_id}'

After adding this model, run:
cd backend && .venv/bin/python manage.py makemigrations
.venv/bin/python manage.py migrate
```

---

### Task 2.1: Create gig visibility function

**File:** `backend/businesses/gig_location.py` (NEW FILE)

**Prompt:**
```
Create backend/businesses/gig_location.py with a function to filter visible gig posts for a provider.

Requirements:
- Import: from businesses.location import haversine_miles, parse_radius_miles
- Import: from jobs.models import GigPost

Create function:
def visible_gig_posts_for_organization(organization, base_qs=None):
    """
    Return gig posts visible to this provider based on dual-radius matching.
    
    A post matches if ANY active org location satisfies BOTH:
    1. distance <= post.search_radius_miles (customer's search area)
    2. distance <= location.radius_miles (provider's service area)
    
    Args:
        organization: Organization instance
        base_qs: Optional GigPost queryset to filter (defaults to all open posts)
    
    Returns:
        Filtered QuerySet of GigPost
    """
    qs = base_qs if base_qs is not None else GigPost.objects.filter(status='open')
    
    visible_ids = set()
    
    # Get all active locations for this organization
    locations = organization.locations.filter(is_active=True)
    
    for loc in locations:
        if loc.latitude is None or loc.longitude is None:
            continue
            
        # Get all posts with coordinates
        posts = qs.exclude(location_latitude__isnull=True).exclude(location_longitude__isnull=True)
        
        for post in posts:
            # Calculate distance between provider location and gig post location
            dist = haversine_miles(
                float(loc.latitude), float(loc.longitude),
                float(post.location_latitude), float(post.location_longitude)
            )
            
            # Check dual radius constraint
            post_radius = parse_radius_miles(post.search_radius_miles)
            provider_radius = parse_radius_miles(loc.radius_miles or 25)
            
            if dist <= post_radius and dist <= provider_radius:
                visible_ids.add(post.id)
    
    return qs.filter(id__in=visible_ids)

Add docstring with example usage.
```

---

### Task 2.2: Create permission helper functions

**File:** `backend/jobs/gig_permissions.py` (NEW FILE)

**Prompt:**
```
Create backend/jobs/gig_permissions.py with permission check functions.

Requirements:
- Import: from businesses.models import OrganizationMembership
- Import: from businesses.gig_location import visible_gig_posts_for_organization
- Import: from .models import GigPost

Function 1:
def can_comment_on_gig(user, gig_post, organization=None):
    """
    Check if user can comment on a gig post.
    
    Rules:
    - Post owner (customer) can always comment
    - Provider staff/owner can comment if post is visible to their org
    
    Args:
        user: User instance
        gig_post: GigPost instance
        organization: Organization instance (required if user is provider)
    
    Returns:
        bool
    """
    # If user owns the post
    if gig_post.customer_id == user.id:
        return True
    
    # If provider, check visibility
    if organization:
        visible = visible_gig_posts_for_organization(
            organization,
            GigPost.objects.filter(id=gig_post.id)
        )
        return visible.exists()
    
    return False

Function 2:
def can_quote_on_gig(user, organization, gig_post):
    """
    Check if provider can submit a quote.
    
    Rules:
    - Must be owner or staff of organization
    - Post must be visible to organization
    - Post status must be 'open' or 'quoted'
    
    Args:
        user: User instance
        organization: Organization instance
        gig_post: GigPost instance
    
    Returns:
        bool
    """
    # Check membership
    membership = OrganizationMembership.objects.filter(
        organization=organization,
        user=user,
        role__in=['owner', 'staff']
    ).first()
    
    if not membership:
        return False
    
    # Check visibility
    visible = visible_gig_posts_for_organization(
        organization,
        GigPost.objects.filter(id=gig_post.id)
    )
    if not visible.exists():
        return False
    
    # Check post status
    if gig_post.status not in ['open', 'quoted']:
        return False
    
    return True
```

---

### Task 4.3: Create provider gig list view

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add ProviderGigPostViewSet to backend/jobs/gig_views.py (created in Task 4.1).

Requirements:
- Import: from businesses.gig_location import visible_gig_posts_for_organization
- Import: from businesses.models import OrganizationMembership

Create ProviderGigPostViewSet(viewsets.ReadOnlyModelViewSet):
- queryset = GigPost.objects.filter(status='open')
- serializer_class = GigPostSerializer
- permission_classes = [permissions.IsAuthenticated]
- pagination_class: 20 items per page

- Override get_queryset(self):
  # Get user's organization (must be staff or owner)
  membership = OrganizationMembership.objects.filter(
      user=self.request.user,
      role__in=['owner', 'staff']
  ).select_related('organization').first()
  
  if not membership:
      return GigPost.objects.none()
  
  # Filter by visibility
  qs = visible_gig_posts_for_organization(membership.organization)
  
  # Apply filters from query params
  category = self.request.query_params.get('category')
  if category:
      qs = qs.filter(category__slug=category)
  
  status_filter = self.request.query_params.get('status', 'open')
  if status_filter:
      qs = qs.filter(status=status_filter)
  
  return qs.order_by('-created_at')

Only implement list action (readonly viewset).
```

---

### Task 5.1: Create GigCategoryFilter component

**File:** `frontend/src/components/gigs/GigCategoryFilter.js` (NEW FILE)

**Prompt:**
```
Create a React dropdown component for filtering gigs by category.

Requirements:
- Component: GigCategoryFilter
- Props:
  * value: current selected category slug (or null for "All")
  * onChange: function(categorySlug) - called when selection changes

State:
- categories: [] (fetch from /api/businesses/types/)
- loading: boolean

Features:
- Fetch categories on mount
- Show "All Categories" as first option (value=null)
- Map categories to <option> elements
- Select element with value prop and onChange handler

Return JSX:
<div className="category-filter">
  <label htmlFor="category">Category</label>
  <select
    id="category"
    value={value || ''}
    onChange={(e) => onChange(e.target.value || null)}
    disabled={loading}
  >
    <option value="">All Categories</option>
    {categories.map(cat => (
      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
    ))}
  </select>
</div>

Style to match existing Luminexa form controls.
```

---

### Task 5.3: Create GigPostCard component

**File:** `frontend/src/components/gigs/GigPostCard.js` (NEW FILE)

**Prompt:**
```
Create a card component to display a gig post in a list.

Requirements:
- Component: GigPostCard
- Props:
  * post: gig post object { id, title, description, location_city, location_state, category_name, quote_count, created_at, status }
  * onClick: function() - called when card is clicked
  * showDistance: boolean (optional, show distance badge if provided)
  * distance: number (optional, miles)

Features:
- Clickable card (cursor pointer)
- Display:
  * Title (bold, truncate if too long)
  * Description (truncate to 150 chars with "...")
  * Category badge (pill/tag style)
  * Location: "{city}, {state}"
  * Quote count badge: "3 quotes" or "No quotes yet"
  * Time ago: "Posted 2 hours ago" (use relative time)
  * Status badge if not 'open' (colored)
  * Distance badge if showDistance && distance (e.g. "5.2 mi")

Layout:
- Card with shadow/border
- Flex layout: content on left, badges/meta on right
- Hover effect (scale or shadow)

Return JSX matching existing Luminexa card styles.
```

---

### Task 6.2: Create CustomerGigWallPage

**File:** `frontend/src/pages/gigs/CustomerGigWallPage.js` (NEW FILE)

**Prompt:**
```
Create a page for customers to view their own gig posts.

Requirements:
- Import: useState, useEffect, useNavigate
- Import: api from utils/api
- Import: GigPostCard from components/gigs/GigPostCard

State:
- posts: []
- loading: true
- error: null

Functions:
- fetchPosts(): GET /api/jobs/gigs/ (returns user's own posts)
- handleCardClick(postId): navigate to /gigs/{postId}

Layout:
- Page header: "My Gig Posts"
- Button: "Create New Gig Post" -> navigate to /gigs/create
- Grid/list of GigPostCard components
- Show loading spinner while fetching
- Show error message if fetch fails
- Empty state: "You haven't posted any gigs yet. Create your first gig post to get started!"

Return JSX:
<div className="customer-gig-wall-page">
  <div className="page-header">
    <h1>My Gig Posts</h1>
    <button onClick={() => navigate('/gigs/create')}>Create New Gig Post</button>
  </div>
  {loading && <LoadingSpinner />}
  {error && <ErrorMessage message={error} />}
  {!loading && posts.length === 0 && <EmptyState />}
  {!loading && posts.length > 0 && (
    <div className="gig-posts-grid">
      {posts.map(post => (
        <GigPostCard
          key={post.id}
          post={post}
          onClick={() => handleCardClick(post.id)}
        />
      ))}
    </div>
  )}
</div>

Style to match existing Luminexa pages.
```

---

### Task 6.3: Create ProviderGigWallPage

**File:** `frontend/src/pages/gigs/ProviderGigWallPage.js` (NEW FILE)

**Prompt:**
```
Create a page for providers to browse available gigs in their area.

Requirements:
- Import: useState, useEffect, useNavigate
- Import: api from utils/api
- Import: GigPostCard, GigCategoryFilter

State:
- posts: []
- selectedCategory: null
- loading: true
- error: null

Functions:
- fetchPosts(): GET /api/jobs/gigs/?role=provider&category={selectedCategory}
- handleCategoryChange(categorySlug): set selectedCategory, trigger refetch
- handleCardClick(postId): navigate to /gigs/{postId}

Effects:
- Fetch posts on mount and when selectedCategory changes

Layout:
- Page header: "Gig Wall - Available Jobs"
- Filters row: GigCategoryFilter component
- Grid/list of GigPostCard components (with distance shown)
- Loading spinner
- Error message
- Empty state: "No gigs available in your service area. Check back later!"

Return JSX similar to Task 6.2 but with category filter and distance on cards.
```

---

## SLICE 3: Comments System

### Task 3.4: Create GigComment serializer

**File:** `backend/jobs/serializers.py` (or gig_serializers.py)

**Prompt:**
```
Add GigCommentSerializer to the serializers file.

Requirements:
- Import: from .models import GigComment

Create GigCommentSerializer(serializers.ModelSerializer):
- Meta:
  * model = GigComment
  * fields = ['id', 'author_name', 'organization_name', 'body', 'created_at', 'is_customer_comment']
  * read_only_fields = ['id', 'author_name', 'organization_name', 'created_at', 'is_customer_comment']

- Add computed fields:
  * author_name = serializers.CharField(source='author.full_name', read_only=True)
  * organization_name = serializers.CharField(source='organization.name', read_only=True)
  * is_customer_comment = serializers.SerializerMethodField()

- Method get_is_customer_comment(self, obj):
    return obj.gig_post.customer_id == obj.author_id

For writes, create GigCommentWriteSerializer:
- Meta:
  * model = GigComment
  * fields = ['body']

- Validate body: max 1000 chars, not empty after strip
```

---

### Task 4.5: Create gig comment view

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add GigCommentViewSet to backend/jobs/gig_views.py.

Requirements:
- Import: from .models import GigComment
- Import: from .serializers import GigCommentSerializer, GigCommentWriteSerializer
- Import: from jobs.gig_permissions import can_comment_on_gig
- Import: from businesses.models import OrganizationMembership
- Import: from rest_framework.exceptions import PermissionDenied

Create GigCommentViewSet(viewsets.ModelViewSet):
- queryset = GigComment.objects.all()
- permission_classes = [permissions.IsAuthenticated]

- Override get_queryset(self):
  # Filter by gig_post from URL (/api/jobs/gigs/<gig_post_id>/comments/)
  gig_post_id = self.kwargs.get('gig_post_id')
  if gig_post_id:
      return GigComment.objects.filter(gig_post_id=gig_post_id).order_by('created_at')
  return GigComment.objects.none()

- Override get_serializer_class(self):
  if self.action == 'create':
      return GigCommentWriteSerializer
  return GigCommentSerializer

- Override perform_create(self, serializer):
  gig_post_id = self.kwargs.get('gig_post_id')
  gig_post = GigPost.objects.get(id=gig_post_id)
  
  # Get user's organization if provider
  membership = OrganizationMembership.objects.filter(
      user=self.request.user,
      role__in=['owner', 'staff']
  ).first()
  org = membership.organization if membership else None
  
  # Check permission
  if not can_comment_on_gig(self.request.user, gig_post, org):
      raise PermissionDenied("You cannot comment on this gig post.")
  
  serializer.save(
      author=self.request.user,
      gig_post=gig_post,
      organization=org
  )

Only implement list and create actions.
```

---

### Task 5.4: Create GigCommentThread component

**File:** `frontend/src/components/gigs/GigCommentThread.js` (NEW FILE)

**Prompt:**
```
Create a component to display a list of comments.

Requirements:
- Component: GigCommentThread
- Props:
  * comments: array of comment objects
  * loading: boolean

Features:
- Display each comment with:
  * Author name (bold if customer, regular if provider)
  * Badge: "Customer" or "Provider: {org_name}"
  * Comment body
  * Time ago (relative time)
- Show loading spinner if loading=true
- Empty state: "No comments yet. Be the first to ask a question!"

Layout:
- Vertical list of comment cards
- Customer comments on left with blue accent
- Provider comments on right with gray accent (chat-like)

Return JSX:
<div className="gig-comment-thread">
  {loading && <LoadingSpinner />}
  {!loading && comments.length === 0 && <p>No comments yet...</p>}
  {!loading && comments.map(comment => (
    <div key={comment.id} className={`comment ${comment.is_customer_comment ? 'customer' : 'provider'}`}>
      <div className="comment-header">
        <strong>{comment.author_name}</strong>
        {comment.is_customer_comment ? (
          <span className="badge">Customer</span>
        ) : (
          <span className="badge">Provider: {comment.organization_name}</span>
        )}
        <span className="time">{formatTimeAgo(comment.created_at)}</span>
      </div>
      <div className="comment-body">{comment.body}</div>
    </div>
  ))}
</div>

Style to match existing Luminexa comment/chat UIs.
```

---

### Task 5.5: Create GigCommentForm component

**File:** `frontend/src/components/gigs/GigCommentForm.js` (NEW FILE)

**Prompt:**
```
Create a form component for submitting comments.

Requirements:
- Component: GigCommentForm
- Props:
  * onSubmit: function(body) - called with comment text
  * disabled: boolean (submission in progress)

State:
- body: string
- error: string

Features:
- Textarea with placeholder "Ask a question or add a comment..."
- Character counter: "{body.length}/1000"
- Submit button: "Post Comment" (disabled if empty or > 1000 chars or props.disabled)
- Show error message if validation fails
- Clear textarea after successful submit

Return JSX:
<div className="gig-comment-form">
  <textarea
    value={body}
    onChange={(e) => setBody(e.target.value)}
    placeholder="Ask a question or add a comment..."
    maxLength={1000}
    rows={3}
  />
  <div className="form-footer">
    <span className="char-count">{body.length}/1000</span>
    <button
      onClick={handleSubmit}
      disabled={!body.trim() || body.length > 1000 || disabled}
    >
      Post Comment
    </button>
  </div>
  {error && <p className="error">{error}</p>}
</div>

Style to match existing Luminexa forms.
```

---

## SLICE 4: Quotes System

### Task 1.4: Create GigQuote model

**File:** `backend/jobs/models.py`

**Prompt:**
```
Add GigQuote model to backend/jobs/models.py after GigComment.

Requirements:
- Import: from decimal import Decimal at top

Create GigQuote model with:
- Status TextChoices: SUBMITTED='submitted', ACCEPTED='accepted', WITHDRAWN='withdrawn'

- Fields:
  * gig_post: ForeignKey to GigPost, on_delete=CASCADE, related_name='quotes'
  * organization: ForeignKey to Organization, on_delete=CASCADE, related_name='gig_quotes'
  * submitted_by: ForeignKey to settings.AUTH_USER_MODEL, on_delete=SET_NULL, null=True, blank=True, related_name='gig_quotes_submitted'
  * price: DecimalField, max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))]
  * description: TextField, max_length=1500
  * estimated_duration_days: PositiveIntegerField, null=True, blank=True
  * status: CharField, max_length=20, choices=Status.choices, default=Status.SUBMITTED, db_index=True
  * created_at: DateTimeField, auto_now_add=True
  * updated_at: DateTimeField, auto_now=True

- Meta:
  * ordering = ['price', 'created_at']  # Lowest price first
  * constraints = [
      models.UniqueConstraint(
          fields=['gig_post', 'organization'],
          name='one_quote_per_org_per_post'
      )
    ]
  * indexes = [
      models.Index(fields=['gig_post', 'price']),
      models.Index(fields=['organization', '-created_at']),
    ]

- __str__: return f'Quote ${self.price} by {self.organization.slug} on GigPost {self.gig_post_id}'

After adding, run:
cd backend && .venv/bin/python manage.py makemigrations
.venv/bin/python manage.py migrate
```

---

### Task 3.5: Create GigQuote serializer

**File:** `backend/jobs/serializers.py` (or gig_serializers.py)

**Prompt:**
```
Add GigQuoteSerializer to the serializers file.

Requirements:
- Import: from .models import GigQuote
- Import: from businesses.models import Organization
- Import: from businesses.serializers import OrganizationPublicSerializer (or create minimal one)

Create GigQuoteSerializer(serializers.ModelSerializer):
- Meta:
  * model = GigQuote
  * fields = ['id', 'organization', 'organization_distance', 'organization_rating', 
              'price', 'description', 'estimated_duration_days', 'status', 
              'created_at', 'updated_at']
  * read_only_fields = ['id', 'organization', 'status', 'created_at', 'updated_at']

- Add computed fields:
  * organization = OrganizationPublicSerializer(read_only=True)  # Nested: {name, logo, slug}
  * organization_distance = serializers.SerializerMethodField()
  * organization_rating = serializers.SerializerMethodField()

- Method get_organization_distance(self, obj):
    # Calculate distance between org primary location and gig post location
    # Use haversine_miles from businesses.location
    # Return rounded distance or None if no coords
    from businesses.location import haversine_miles
    gig_post = obj.gig_post
    org_loc = obj.organization.primary_location()
    if not org_loc or not gig_post.location_latitude:
        return None
    if not org_loc.latitude or not org_loc.longitude:
        return None
    dist = haversine_miles(
        float(org_loc.latitude), float(org_loc.longitude),
        float(gig_post.location_latitude), float(gig_post.location_longitude)
    )
    return round(dist, 1)

- Method get_organization_rating(self, obj):
    # Calculate average rating from organization's service reviews
    # Return average or None if no reviews
    from django.db.models import Avg
    from jobs.models import ServiceReview
    reviews = ServiceReview.objects.filter(service__organization=obj.organization)
    avg = reviews.aggregate(
        avg_rating=Avg(
            (models.F('communication') + models.F('price') + 
             models.F('punctual') + models.F('quality')) / 4.0
        )
    )['avg_rating']
    return round(avg, 1) if avg else None

For writes, create GigQuoteWriteSerializer:
- Meta:
  * model = GigQuote
  * fields = ['price', 'description', 'estimated_duration_days']

- Validate price > 0, description not empty
```

---

### Task 4.6: Create gig quote CRUD views

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add GigQuoteViewSet to backend/jobs/gig_views.py.

Requirements:
- Import: from .models import GigQuote
- Import: from .serializers import GigQuoteSerializer, GigQuoteWriteSerializer
- Import: from jobs.gig_permissions import can_quote_on_gig
- Import: from businesses.models import OrganizationMembership
- Import: from rest_framework.exceptions import PermissionDenied, ValidationError

Create GigQuoteViewSet(viewsets.ModelViewSet):
- queryset = GigQuote.objects.all()
- permission_classes = [permissions.IsAuthenticated]

- Override get_queryset(self):
  gig_post_id = self.kwargs.get('gig_post_id')
  if gig_post_id:
      # Customer sees all quotes for their post
      # Provider sees only their own quote
      gig_post = GigPost.objects.get(id=gig_post_id)
      if gig_post.customer_id == self.request.user.id:
          return GigQuote.objects.filter(gig_post_id=gig_post_id).order_by('price')
      else:
          membership = OrganizationMembership.objects.filter(
              user=self.request.user,
              role__in=['owner', 'staff']
          ).first()
          if membership:
              return GigQuote.objects.filter(gig_post_id=gig_post_id, organization=membership.organization)
      return GigQuote.objects.none()
  return GigQuote.objects.none()

- Override get_serializer_class(self):
  if self.action in ['create', 'update', 'partial_update']:
      return GigQuoteWriteSerializer
  return GigQuoteSerializer

- Override perform_create(self, serializer):
  gig_post_id = self.kwargs.get('gig_post_id')
  gig_post = GigPost.objects.get(id=gig_post_id)
  
  membership = OrganizationMembership.objects.filter(
      user=self.request.user,
      role__in=['owner', 'staff']
  ).first()
  
  if not membership:
      raise PermissionDenied("You must be a provider to submit quotes.")
  
  if not can_quote_on_gig(self.request.user, membership.organization, gig_post):
      raise PermissionDenied("You cannot quote on this gig post.")
  
  # Check for existing quote
  if GigQuote.objects.filter(gig_post=gig_post, organization=membership.organization).exists():
      raise ValidationError("You already submitted a quote for this gig.")
  
  serializer.save(
      gig_post=gig_post,
      organization=membership.organization,
      submitted_by=self.request.user
  )
  
  # Update gig post status to 'quoted' if first quote
  if gig_post.status == 'open':
      gig_post.status = 'quoted'
      gig_post.save(update_fields=['status', 'updated_at'])

- Override perform_update(self, serializer):
  # Only allow edit if status='submitted'
  if self.get_object().status != 'submitted':
      raise ValidationError("Cannot edit a quote that has been accepted or withdrawn.")
  serializer.save()

- Override perform_destroy(self, instance):
  # Soft delete: set status='withdrawn'
  if instance.status != 'submitted':
      raise ValidationError("Cannot withdraw this quote.")
  instance.status = 'withdrawn'
  instance.save(update_fields=['status', 'updated_at'])

Implement list, create, update, destroy actions.
```

---

### Task 4.7: Create quote acceptance view

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add GigQuoteAcceptView to backend/jobs/gig_views.py.

Requirements:
- Import: from rest_framework.decorators import action
- Import: from .models import GigQuote, CustomerServiceInquiry

Add this as an action inside GigQuoteViewSet:

@action(detail=True, methods=['post'], url_path='accept')
def accept_quote(self, request, gig_post_id=None, pk=None):
    """Customer accepts a quote, creating an inquiry and updating statuses."""
    quote = self.get_object()
    gig_post = quote.gig_post
    
    # Validate: user must own the gig post
    if gig_post.customer_id != request.user.id:
        return Response(
            {"detail": "You can only accept quotes on your own posts."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Validate: quote must be in submitted status
    if quote.status != 'submitted':
        return Response(
            {"detail": "This quote cannot be accepted."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update quote status
    quote.status = 'accepted'
    quote.save(update_fields=['status', 'updated_at'])
    
    # Update gig post status
    gig_post.status = 'accepted'
    gig_post.save(update_fields=['status', 'updated_at'])
    
    # Create CustomerServiceInquiry linking to the quote
    inquiry = CustomerServiceInquiry.objects.create(
        organization=quote.organization,
        customer=request.user,
        service_label=gig_post.title,
        message=f"Accepted quote from gig post: {gig_post.title}\n\n{quote.description}",
        service_address=gig_post.location_address,
        status='quote_accepted',
        quote_amount=quote.price,
        quote_message=quote.description,
    )
    
    # TODO: Create notification for provider (Task 8.2)
    
    serializer = GigQuoteSerializer(quote)
    return Response(serializer.data)

This creates the link between gig quote acceptance and the booking flow.
```

---

### Task 5.6: Create GigQuoteCard component

**File:** `frontend/src/components/gigs/GigQuoteCard.js` (NEW FILE)

**Prompt:**
```
Create a card component to display a single quote.

Requirements:
- Component: GigQuoteCard
- Props:
  * quote: quote object { id, organization {name, logo, slug}, price, description, estimated_duration_days, organization_distance, organization_rating, status }
  * showAcceptButton: boolean
  * onAccept: function(quoteId) - called when Accept button clicked

Features:
- Display:
  * Organization logo (small, left side)
  * Organization name (bold, clickable to /org/{slug})
  * Price: Large, prominent "$123.45"
  * Description: Quote details (truncate if long, show "Read more")
  * Estimated duration: "Est. 3 days" (if provided)
  * Distance: "5.2 mi away"
  * Rating: "⭐ 4.8" (if available)
  * Status badge if accepted: "✓ Accepted" (green)
- Accept button (if showAcceptButton && status='submitted'):
  * "Accept This Quote" button (primary style)
  * Confirm dialog: "Accept this quote for $X? This will close the gig post."

Layout:
- Card with border/shadow
- Left: org logo
- Middle: content (name, description, meta)
- Right: price + button (stacked)

Return JSX matching existing Luminexa card styles.
```

---

### Task 5.7: Create GigQuoteList component

**File:** `frontend/src/components/gigs/GigQuoteList.js` (NEW FILE)

**Prompt:**
```
Create a component to display all quotes for a gig post.

Requirements:
- Component: GigQuoteList
- Props:
  * quotes: array of quote objects (already sorted by price from API)
  * canAccept: boolean (true if current user owns the post)
  * onAcceptQuote: function(quoteId)
  * loading: boolean

Features:
- Display heading: "Quotes ({quotes.length})"
- Subheading: "Sorted by price - lowest first"
- Map quotes to GigQuoteCard components
- Show loading spinner if loading=true
- Empty state: "No quotes yet. Providers will submit quotes soon!"

Return JSX:
<div className="gig-quote-list">
  <div className="list-header">
    <h2>Quotes ({quotes.length})</h2>
    <p>Sorted by price - lowest first</p>
  </div>
  {loading && <LoadingSpinner />}
  {!loading && quotes.length === 0 && <p className="empty-state">No quotes yet...</p>}
  {!loading && quotes.map(quote => (
    <GigQuoteCard
      key={quote.id}
      quote={quote}
      showAcceptButton={canAccept && quote.status === 'submitted'}
      onAccept={() => onAcceptQuote(quote.id)}
    />
  ))}
</div>

Style with spacing between cards.
```

---

### Task 5.8: Create GigQuoteForm component

**File:** `frontend/src/components/gigs/GigQuoteForm.js` (NEW FILE)

**Prompt:**
```
Create a form component for providers to submit quotes.

Requirements:
- Component: GigQuoteForm
- Props:
  * onSubmit: function({ price, description, estimated_duration_days })
  * initialData: object (for editing existing quote)
  * loading: boolean

State:
- formData: { price: '', description: '', estimated_duration_days: '' }
- errors: {}

Features:
- Price input (number, required, min=0.01, step=0.01, prefix with $)
- Description textarea (required, max 1500 chars, show counter)
- Estimated duration input (optional, number, suffix with "days")
- Submit button: "Submit Quote" (or "Update Quote" if editing)
- Clear form after submit (unless editing)
- Validate on submit:
  * Price > 0
  * Description not empty and <= 1500 chars

Return JSX:
<form onSubmit={handleSubmit} className="gig-quote-form">
  <h3>{initialData ? 'Update Your Quote' : 'Submit a Quote'}</h3>
  
  <div className="form-group">
    <label>Price *</label>
    <div className="input-with-prefix">
      <span>$</span>
      <input
        type="number"
        step="0.01"
        min="0.01"
        value={formData.price}
        onChange={handleChange}
        required
      />
    </div>
    {errors.price && <span className="error">{errors.price}</span>}
  </div>
  
  <div className="form-group">
    <label>What this quote covers *</label>
    <textarea
      value={formData.description}
      onChange={handleChange}
      maxLength={1500}
      rows={4}
      required
    />
    <span className="char-count">{formData.description.length}/1500</span>
    {errors.description && <span className="error">{errors.description}</span>}
  </div>
  
  <div className="form-group">
    <label>Estimated duration (optional)</label>
    <div className="input-with-suffix">
      <input
        type="number"
        min="1"
        value={formData.estimated_duration_days}
        onChange={handleChange}
      />
      <span>days</span>
    </div>
  </div>
  
  <button type="submit" disabled={loading}>
    {loading ? 'Submitting...' : (initialData ? 'Update Quote' : 'Submit Quote')}
  </button>
</form>

Style to match existing Luminexa forms.
```

---

## SLICE 5: Detail Pages

### Task 4.2: Create customer gig detail view

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add retrieve, update, and destroy actions to CustomerGigPostViewSet in backend/jobs/gig_views.py.

Requirements:
- Add to existing CustomerGigPostViewSet from Task 4.1

Override these methods:

1. retrieve(self, request, pk=None):
   - Return gig post with images, comments count, quotes count
   - Use GigPostSerializer

2. partial_update(self, request, pk=None):
   - Only allow editing title and description
   - Only if status='open'
   - Only if user owns the post
   - Use GigPostWriteSerializer

3. destroy(self, request, pk=None):
   - Soft delete: set status='closed'
   - Only if user owns the post
   - Return 204 No Content

Add permission check:
def check_object_permissions(self, request, obj):
    super().check_object_permissions(request, obj)
    if obj.customer_id != request.user.id:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You can only modify your own gig posts.")
```

---

### Task 4.4: Create gig image upload view

**File:** `backend/jobs/gig_views.py`

**Prompt:**
```
Add GigPostImageViewSet to backend/jobs/gig_views.py.

Requirements:
- Import: from .models import GigPostImage
- Import: from .serializers import GigPostImageSerializer
- Import: from rest_framework.exceptions import ValidationError

Create GigPostImageViewSet(viewsets.ModelViewSet):
- queryset = GigPostImage.objects.all()
- serializer_class = GigPostImageSerializer
- permission_classes = [permissions.IsAuthenticated]

- Override get_queryset(self):
  gig_post_id = self.kwargs.get('gig_post_id')
  if gig_post_id:
      return GigPostImage.objects.filter(gig_post_id=gig_post_id).order_by('sort_order')
  return GigPostImage.objects.none()

- Override perform_create(self, serializer):
  gig_post_id = self.kwargs.get('gig_post_id')
  gig_post = GigPost.objects.get(id=gig_post_id)
  
  # Check ownership
  if gig_post.customer_id != self.request.user.id:
      raise PermissionDenied("You can only add images to your own posts.")
  
  # Check max count
  existing_count = GigPostImage.objects.filter(gig_post=gig_post).count()
  if existing_count >= GigPostImage.MAX_PER_POST:
      raise ValidationError(f"Maximum {GigPostImage.MAX_PER_POST} images per post.")
  
  serializer.save(gig_post=gig_post, sort_order=existing_count)

- Override perform_destroy(self, instance):
  # Check ownership
  if instance.gig_post.customer_id != self.request.user.id:
      raise PermissionDenied("You can only delete images from your own posts.")
  instance.delete()

Only implement create and destroy actions.
```

---

### Task 6.4: Create GigPostDetailPage (customer view)

**File:** `frontend/src/pages/gigs/GigPostDetailPage.js` (NEW FILE)

**Prompt:**
```
Create a detail page to view a gig post with tabs for comments and quotes.

Requirements:
- Import: useState, useEffect, useParams, useNavigate
- Import: api from utils/api
- Import: GigCommentThread, GigCommentForm, GigQuoteList

State:
- post: null
- comments: []
- quotes: []
- activeTab: 'comments' or 'quotes'
- loading: true
- error: null
- commentSubmitting: false
- quoteAccepting: false

Functions:
- fetchPost(): GET /api/jobs/gigs/{id}/
- fetchComments(): GET /api/jobs/gigs/{id}/comments/
- fetchQuotes(): GET /api/jobs/gigs/{id}/quotes/
- handleCommentSubmit(body): POST /api/jobs/gigs/{id}/comments/
- handleQuoteAccept(quoteId): POST /api/jobs/gigs/quotes/{quoteId}/accept/
- handleEdit(): navigate to /gigs/{id}/edit
- handleClose(): PATCH /api/jobs/gigs/{id}/ with status='closed'

Layout:
- Header:
  * Back button
  * Title (large)
  * Status badge
  * Edit/Close buttons (if owner and status='open')
- Content section:
  * Description (full text)
  * Category badge
  * Location (address, city, state)
  * Radius: "Searching within {radius} miles"
  * Images (gallery, 2 max)
  * Posted by: {customer_name}
  * Posted: {time ago}
- Tabs:
  * "Comments ({count})" tab
  * "Quotes ({count})" tab
- Tab content:
  * Comments tab: GigCommentThread + GigCommentForm (if owner)
  * Quotes tab: GigQuoteList (sorted by price)

Conditional rendering:
- If current user is customer (owner), show quotes with Accept buttons
- If current user is provider, show quote form OR own submitted quote

Return JSX with tabs and conditional sections.
```

---

### Task 6.5: Create GigPostDetailPage (provider view)

**Prompt:**
```
The same GigPostDetailPage.js should handle both customer and provider views.

Add logic to determine user role:
- Check if post.customer.id === currentUser.id → customer view
- Else → provider view

For provider view:
- Comments tab: Show GigCommentThread + GigCommentForm (providers can comment)
- Quotes tab:
  * If provider has already submitted a quote: show their quote with Edit/Withdraw buttons
  * Else: show GigQuoteForm to submit a new quote
  * Do NOT show other providers' quotes

API calls for provider actions:
- Submit quote: POST /api/jobs/gigs/{id}/quotes/
- Edit quote: PATCH /api/jobs/gigs/quotes/{quoteId}/
- Withdraw quote: DELETE /api/jobs/gigs/quotes/{quoteId}/

Add state:
- userRole: 'customer' | 'provider' | null
- ownQuote: quote object or null
- quoteFormVisible: boolean

Detect role on mount:
useEffect(() => {
  if (post) {
    if (post.customer.id === currentUser.id) {
      setUserRole('customer');
    } else {
      setUserRole('provider');
      // Fetch own quote
      fetchOwnQuote();
    }
  }
}, [post]);

Render quotes tab conditionally based on userRole.
```

---

### Task 6.6: Create ProviderMyQuotesPage

**File:** `frontend/src/pages/gigs/ProviderMyQuotesPage.js` (NEW FILE)

**Prompt:**
```
Create a page for providers to view all their submitted quotes.

Requirements:
- Import: useState, useEffect, useNavigate
- Import: api from utils/api
- Import: GigQuoteCard (or create simplified version)

State:
- quotes: []
- filter: 'all' | 'submitted' | 'accepted' | 'withdrawn'
- loading: true
- error: null

Functions:
- fetchQuotes(): GET /api/jobs/gigs/my-quotes/ (new endpoint or filter existing)
  * Returns quotes with embedded gig_post data
- handleFilterChange(newFilter): set filter, refetch
- handleQuoteClick(quoteId): navigate to gig post detail

Layout:
- Page header: "My Submitted Quotes"
- Filter tabs: All | Submitted | Accepted | Withdrawn
- List of quotes grouped by status
  * Each quote card shows:
    - Gig post title (clickable)
    - Customer name
    - Quote price
    - Quote description (truncated)
    - Status badge
    - Submitted date
- Empty state: "You haven't submitted any quotes yet"

Return JSX:
<div className="provider-my-quotes-page">
  <h1>My Submitted Quotes</h1>
  
  <div className="filter-tabs">
    {['all', 'submitted', 'accepted', 'withdrawn'].map(f => (
      <button
        key={f}
        className={filter === f ? 'active' : ''}
        onClick={() => handleFilterChange(f)}
      >
        {f.charAt(0).toUpperCase() + f.slice(1)}
      </button>
    ))}
  </div>
  
  {loading && <LoadingSpinner />}
  {error && <ErrorMessage />}
  {!loading && quotes.length === 0 && <EmptyState />}
  
  {!loading && quotes.map(quote => (
    <div key={quote.id} className="quote-item" onClick={() => handleQuoteClick(quote.id)}>
      <h3>{quote.gig_post.title}</h3>
      <p>Customer: {quote.gig_post.customer_name}</p>
      <p className="price">${quote.price}</p>
      <p>{quote.description.slice(0, 100)}...</p>
      <span className={`badge ${quote.status}`}>{quote.status}</span>
      <span className="date">{formatDate(quote.created_at)}</span>
    </div>
  ))}
</div>
```

---

## SLICE 6: Integration

### Task 4.8: Register all URLs

**File:** `backend/jobs/urls.py`

**Prompt:**
```
Register gig wall ViewSets in backend/jobs/urls.py.

Requirements:
- Import: from .gig_views import (
    CustomerGigPostViewSet,
    ProviderGigPostViewSet,
    GigCommentViewSet,
    GigQuoteViewSet,
    GigPostImageViewSet,
)

Add to urlpatterns:
# Customer gig posts (CRUD)
router.register(r'gigs', CustomerGigPostViewSet, basename='customer-gigs')

# Provider gig browsing (readonly)
router.register(r'gigs-provider', ProviderGigPostViewSet, basename='provider-gigs')

# Nested routes for comments
router.register(
    r'gigs/(?P<gig_post_id>\d+)/comments',
    GigCommentViewSet,
    basename='gig-comments'
)

# Nested routes for quotes
router.register(
    r'gigs/(?P<gig_post_id>\d+)/quotes',
    GigQuoteViewSet,
    basename='gig-quotes'
)

# Nested routes for images
router.register(
    r'gigs/(?P<gig_post_id>\d+)/images',
    GigPostImageViewSet,
    basename='gig-images'
)

Test each endpoint:
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:9001/api/jobs/gigs/
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:9001/api/jobs/gigs-provider/
curl -H "Authorization: Token YOUR_TOKEN" http://localhost:9001/api/jobs/gigs/1/comments/
```

---

### Task 7.1: Add gig routes to App.js

**File:** `frontend/src/App.js`

**Prompt:**
```
Add routes for gig wall pages in frontend/src/App.js.

Requirements:
- Import gig pages:
  import CreateGigPostPage from './pages/gigs/CreateGigPostPage';
  import CustomerGigWallPage from './pages/gigs/CustomerGigWallPage';
  import GigPostDetailPage from './pages/gigs/GigPostDetailPage';
  import ProviderGigWallPage from './pages/gigs/ProviderGigWallPage';
  import ProviderMyQuotesPage from './pages/gigs/ProviderMyQuotesPage';

Add routes inside <Router>:
{/* Customer gig routes */}
<PrivateRoute path="/gigs/create" component={CreateGigPostPage} exact />
<PrivateRoute path="/gigs/my-posts" component={CustomerGigWallPage} exact />
<PrivateRoute path="/gigs/:id" component={GigPostDetailPage} exact />

{/* Provider gig routes */}
<PrivateRoute path="/provider/gigs" component={ProviderGigWallPage} exact />
<PrivateRoute path="/provider/gigs/my-quotes" component={ProviderMyQuotesPage} exact />

Note: GigPostDetailPage serves both customer and provider views (conditional rendering).
```

---

### Task 7.2: Add customer navigation links

**File:** Find customer navigation component (e.g., `CustomerSidebar.js` or `CustomerNav.js`)

**Prompt:**
```
Add "Gig Wall" menu item to customer navigation.

Requirements:
- Find the file that renders customer navigation (check components/navigation/ or components/layout/)
- Add a menu item:

<NavLink to="/gigs/my-posts" className="nav-item">
  <GigIcon />
  <span>My Gig Posts</span>
  {gigPostCount > 0 && <span className="badge">{gigPostCount}</span>}
</NavLink>

Also add a floating action button (FAB) on customer home:
<Link to="/gigs/create" className="fab">
  <PlusIcon />
</Link>

Fetch gig post count:
useEffect(() => {
  if (user && user.role === 'customer') {
    api.get('/api/jobs/gigs/').then(res => {
      setGigPostCount(res.data.results.filter(p => p.status === 'open').length);
    });
  }
}, [user]);
```

---

### Task 7.3: Add provider navigation links

**File:** Find provider navigation component (e.g., `ProviderSidebar.js` or `ProviderNav.js`)

**Prompt:**
```
Add "Gig Wall" menu items to provider navigation.

Requirements:
- Add menu item in provider sidebar:

<NavLink to="/provider/gigs" className="nav-item">
  <GigIcon />
  <span>Gig Wall</span>
  {newGigCount > 0 && <span className="badge">{newGigCount}</span>}
</NavLink>

<NavLink to="/provider/gigs/my-quotes" className="nav-item sub-item">
  <QuoteIcon />
  <span>My Quotes</span>
</NavLink>

Fetch new gig count:
useEffect(() => {
  if (organization) {
    api.get('/api/jobs/gigs-provider/').then(res => {
      // Count posts created in last 24 hours
      const now = new Date();
      const recent = res.data.results.filter(p => {
        const created = new Date(p.created_at);
        return (now - created) < 24 * 60 * 60 * 1000;
      });
      setNewGigCount(recent.length);
    });
  }
}, [organization]);
```

---

### Task 8.1: Add gig notification kinds to models

**File:** `backend/jobs/models.py`

**Prompt:**
```
Add new notification types for gig wall events.

Requirements:
1. Find ProviderNotification.Kind TextChoices
   Add these choices:
   - NEW_GIG_IN_AREA = 'new_gig_in_area', 'New gig in your area'
   - GIG_QUOTE_ACCEPTED = 'gig_quote_accepted', 'Quote accepted'
   - NEW_GIG_COMMENT = 'new_gig_comment', 'New comment on gig'

2. Find CustomerNotification.Kind TextChoices
   Add these choices:
   - NEW_GIG_QUOTE = 'new_gig_quote', 'New quote on your gig'
   - NEW_GIG_COMMENT_CUSTOMER = 'new_gig_comment_customer', 'New comment on your gig'
   - GIG_EXPIRED = 'gig_expired', 'Gig post expired'

After adding, run:
cd backend && .venv/bin/python manage.py makemigrations
.venv/bin/python manage.py migrate
```

---

### Task 8.2: Create notification helper for gig events

**File:** `backend/jobs/gig_notifications.py` (NEW FILE)

**Prompt:**
```
Create helper functions to send gig-related notifications.

Requirements:
- Import: from .models import ProviderNotification, CustomerNotification, GigQuote, GigComment

Function 1:
def notify_new_gig_quote(gig_quote):
    """Notify customer when a provider submits a quote."""
    post = gig_quote.gig_post
    CustomerNotification.objects.create(
        customer=post.customer,
        organization=gig_quote.organization,
        kind='new_gig_quote',
        title='New Quote Received',
        message=f'{gig_quote.organization.name} quoted ${gig_quote.price} for "{post.title}"',
        link_path=f'/gigs/{post.id}?tab=quotes',
    )

Function 2:
def notify_quote_accepted(gig_quote):
    """Notify provider when their quote is accepted."""
    post = gig_quote.gig_post
    ProviderNotification.objects.create(
        organization=gig_quote.organization,
        kind='gig_quote_accepted',
        message=f'Your quote of ${gig_quote.price} was accepted for "{post.title}"',
        link_path=f'/gigs/{post.id}',
    )

Function 3:
def notify_new_comment(gig_comment):
    """Notify relevant parties when a comment is posted."""
    post = gig_comment.gig_post
    
    if gig_comment.author_id == post.customer_id:
        # Customer commented, notify providers who have commented or quoted
        orgs = set()
        for comment in post.comments.exclude(organization__isnull=True):
            orgs.add(comment.organization_id)
        for quote in post.quotes.all():
            orgs.add(quote.organization_id)
        
        for org_id in orgs:
            ProviderNotification.objects.create(
                organization_id=org_id,
                kind='new_gig_comment',
                message=f'Customer replied to "{post.title}"',
                link_path=f'/gigs/{post.id}?tab=comments',
            )
    else:
        # Provider commented, notify customer
        CustomerNotification.objects.create(
            customer=post.customer,
            organization=gig_comment.organization,
            kind='new_gig_comment_customer',
            title='New Comment',
            message=f'{gig_comment.organization.name} commented on "{post.title}"',
            link_path=f'/gigs/{post.id}?tab=comments',
        )

Call these from the respective ViewSets (Tasks 4.5, 4.6, 4.7).
```

---

### Task 8.3: Integrate notifications into frontend

**File:** `frontend/src/pages/NotificationsPage.js` (or wherever notifications are rendered)

**Prompt:**
```
Update notification rendering to handle gig notification types.

Requirements:
- Find the notification rendering component/function
- Add cases for new notification kinds:

function renderNotification(notification) {
  switch (notification.kind) {
    // Existing cases...
    
    // Gig notifications
    case 'new_gig_quote':
      return (
        <NotificationCard
          icon={<QuoteIcon />}
          title={notification.title}
          message={notification.message}
          link={notification.link_path}
          timestamp={notification.created_at}
        />
      );
    
    case 'gig_quote_accepted':
      return (
        <NotificationCard
          icon={<CheckCircleIcon />}
          title="Quote Accepted!"
          message={notification.message}
          link={notification.link_path}
          timestamp={notification.created_at}
          variant="success"
        />
      );
    
    case 'new_gig_comment':
    case 'new_gig_comment_customer':
      return (
        <NotificationCard
          icon={<CommentIcon />}
          title={notification.title || 'New Comment'}
          message={notification.message}
          link={notification.link_path}
          timestamp={notification.created_at}
        />
      );
    
    case 'gig_expired':
      return (
        <NotificationCard
          icon={<ClockIcon />}
          title="Gig Post Expired"
          message={notification.message}
          link={notification.link_path}
          timestamp={notification.created_at}
          variant="warning"
        />
      );
    
    default:
      return <DefaultNotificationCard notification={notification} />;
  }
}

Make sure clicking the notification navigates to the correct gig post page.
```

---

## SLICE 7: Admin & Testing

### Task 9.1: Create gig expiration management command

**File:** `backend/jobs/management/commands/expire_gigs.py` (NEW FILE)

**Prompt:**
```
Create a Django management command to auto-close expired gig posts.

Requirements:
- Create directory structure: backend/jobs/management/commands/
- Add __init__.py to both management/ and commands/

Create expire_gigs.py:

from django.core.management.base import BaseCommand
from django.utils import timezone
from jobs.models import GigPost
from jobs.gig_notifications import CustomerNotification


class Command(BaseCommand):
    help = 'Close expired gig posts and notify customers'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # Find expired posts that are still open or quoted
        expired = GigPost.objects.filter(
            expires_at__lte=now,
            status__in=['open', 'quoted']
        )
        
        count = 0
        for post in expired:
            # Count quotes
            quote_count = post.quotes.filter(status='submitted').count()
            
            # Close the post
            post.status = 'closed'
            post.save(update_fields=['status', 'updated_at'])
            
            # Notify customer
            CustomerNotification.objects.create(
                customer=post.customer,
                kind='gig_expired',
                title='Gig Post Expired',
                message=f'Your gig post "{post.title}" expired with {quote_count} quote(s).',
                link_path=f'/gigs/{post.id}',
            )
            
            count += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'Closed {count} expired gig post(s)')
        )

Run manually:
cd backend && .venv/bin/python manage.py expire_gigs

Add to crontab (run daily at 2am):
0 2 * * * cd /path/to/backend && .venv/bin/python manage.py expire_gigs
```

---

### Task 9.2: Register gig models in Django admin

**File:** `backend/jobs/admin.py`

**Prompt:**
```
Register gig models in Django admin for viewing and moderation.

Requirements:
- Import: from .models import GigPost, GigPostImage, GigComment, GigQuote

Add to admin.py:

@admin.register(GigPost)
class GigPostAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'customer', 'category', 'status', 'location_city', 'created_at', 'expires_at']
    list_filter = ['status', 'category', 'created_at']
    search_fields = ['title', 'description', 'customer__email', 'location_city']
    readonly_fields = ['created_at', 'updated_at', 'location_latitude', 'location_longitude']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('customer', 'title', 'description', 'category', 'status')
        }),
        ('Location', {
            'fields': ('location_address', 'location_city', 'location_state', 
                      'location_postal_code', 'search_radius_miles',
                      'location_latitude', 'location_longitude')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'expires_at')
        }),
    )


class GigPostImageInline(admin.TabularInline):
    model = GigPostImage
    extra = 0
    readonly_fields = ['image', 'created_at']


@admin.register(GigComment)
class GigCommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'gig_post', 'author', 'organization', 'body_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['body', 'author__email', 'gig_post__title']
    readonly_fields = ['created_at']
    
    def body_preview(self, obj):
        return obj.body[:100] + '...' if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Comment'


@admin.register(GigQuote)
class GigQuoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'gig_post', 'organization', 'price', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['gig_post__title', 'organization__name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Quote Info', {
            'fields': ('gig_post', 'organization', 'submitted_by', 'price', 
                      'description', 'estimated_duration_days', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

Access admin at: http://localhost:9001/admin/jobs/
```

---

### Task 10.1: Write GigPost model tests

**File:** `backend/jobs/tests/test_gig_models.py` (NEW FILE)

**Prompt:**
```
Create unit tests for gig wall models.

Requirements:
- Import: from django.test import TestCase
- Import: from django.utils import timezone
- Import: from datetime import timedelta
- Import: from jobs.models import GigPost, GigPostImage, GigComment, GigQuote
- Import: from accounts.models import User
- Import: from businesses.models import Organization, BusinessType

Create TestGigModels(TestCase):

def setUp(self):
    self.user = User.objects.create_user(
        email='customer@test.com',
        full_name='Test Customer',
        password='pass123'
    )
    self.category = BusinessType.objects.create(name='Plumbing', slug='plumbing')
    self.org = Organization.objects.create(
        name='Test Plumber',
        slug='test-plumber'
    )

def test_create_gig_post(self):
    post = GigPost.objects.create(
        customer=self.user,
        title='Fix leaky faucet',
        description='Kitchen faucet is dripping',
        category=self.category,
        location_city='Toronto',
        location_state='ON',
        location_postal_code='M5V',
        expires_at=timezone.now() + timedelta(days=30)
    )
    self.assertEqual(post.status, 'open')
    self.assertEqual(str(post), f'{self.user.id}: Fix leaky faucet')

def test_image_max_count_constraint(self):
    post = GigPost.objects.create(...)
    # Create 2 images (max)
    GigPostImage.objects.create(gig_post=post, image='path1.jpg')
    GigPostImage.objects.create(gig_post=post, image='path2.jpg')
    # Attempting 3rd should be prevented by API validation (not DB constraint)
    self.assertEqual(post.images.count(), 2)

def test_quote_unique_constraint(self):
    post = GigPost.objects.create(...)
    # Create first quote
    quote1 = GigQuote.objects.create(
        gig_post=post,
        organization=self.org,
        price=100.00,
        description='We can fix that'
    )
    # Attempting second quote from same org should raise IntegrityError
    from django.db import IntegrityError
    with self.assertRaises(IntegrityError):
        GigQuote.objects.create(
            gig_post=post,
            organization=self.org,
            price=150.00,
            description='Different quote'
        )

def test_quote_ordering_by_price(self):
    post = GigPost.objects.create(...)
    org2 = Organization.objects.create(name='Org2', slug='org2')
    org3 = Organization.objects.create(name='Org3', slug='org3')
    
    GigQuote.objects.create(gig_post=post, organization=self.org, price=200)
    GigQuote.objects.create(gig_post=post, organization=org2, price=100)
    GigQuote.objects.create(gig_post=post, organization=org3, price=150)
    
    quotes = list(post.quotes.all())
    self.assertEqual(quotes[0].price, 100)  # Lowest first
    self.assertEqual(quotes[1].price, 150)
    self.assertEqual(quotes[2].price, 200)

Run tests:
cd backend && .venv/bin/python manage.py test jobs.tests.test_gig_models
```

---

### Task 10.2: Write gig visibility tests

**File:** `backend/businesses/tests/test_gig_location.py` (NEW FILE)

**Prompt:**
```
Create tests for dual-radius visibility logic.

Requirements:
- Follow pattern from backend/businesses/tests/test_location_radius.py
- Import: from businesses.gig_location import visible_gig_posts_for_organization
- Import: from jobs.models import GigPost
- Import: from businesses.models import Organization, OrganizationLocation

Create TestGigVisibility(TestCase):

def setUp(self):
    self.org = Organization.objects.create(name='Test Org', slug='test-org')
    OrganizationLocation.objects.create(
        organization=self.org,
        is_primary=True,
        latitude=43.6532,  # Toronto
        longitude=-79.3832,
        radius_miles=10,
        is_active=True
    )
    
    self.customer = User.objects.create_user(
        email='cust@test.com',
        full_name='Customer'
    )

def test_gig_within_both_radii(self):
    # Post 5 miles away, customer radius 25, provider radius 10
    post = GigPost.objects.create(
        customer=self.customer,
        title='Test Job',
        description='Test',
        location_latitude=43.6,  # ~5 mi from org
        location_longitude=-79.4,
        search_radius_miles=25,  # Customer willing to search 25 mi
        expires_at=timezone.now() + timedelta(days=30)
    )
    
    visible = visible_gig_posts_for_organization(self.org)
    self.assertIn(post, visible)

def test_gig_outside_provider_radius(self):
    # Post 15 miles away, customer radius 25, provider radius 10
    post = GigPost.objects.create(
        customer=self.customer,
        title='Test Job',
        description='Test',
        location_latitude=43.5,  # ~15 mi from org
        location_longitude=-79.5,
        search_radius_miles=25,
        expires_at=timezone.now() + timedelta(days=30)
    )
    
    visible = visible_gig_posts_for_organization(self.org)
    self.assertNotIn(post, visible)

def test_gig_outside_customer_radius(self):
    # Post 15 miles away, customer radius 5, provider radius 25
    post = GigPost.objects.create(
        customer=self.customer,
        title='Test Job',
        description='Test',
        location_latitude=43.5,
        location_longitude=-79.5,
        search_radius_miles=5,  # Customer only searching 5 mi
        expires_at=timezone.now() + timedelta(days=30)
    )
    
    visible = visible_gig_posts_for_organization(self.org)
    self.assertNotIn(post, visible)

def test_multi_location_visibility(self):
    # Add second location 20 miles away
    OrganizationLocation.objects.create(
        organization=self.org,
        latitude=43.8,
        longitude=-79.2,
        radius_miles=10,
        is_active=True
    )
    
    # Post near second location
    post = GigPost.objects.create(
        customer=self.customer,
        title='Test Job',
        description='Test',
        location_latitude=43.75,
        location_longitude=-79.25,
        search_radius_miles=10,
        expires_at=timezone.now() + timedelta(days=30)
    )
    
    visible = visible_gig_posts_for_organization(self.org)
    self.assertIn(post, visible)  # Visible via 2nd location

Run tests:
cd backend && .venv/bin/python manage.py test businesses.tests.test_gig_location
```

---

### Task 10.3: Write gig API permission tests

**File:** `backend/jobs/tests/test_gig_api.py` (NEW FILE)

**Prompt:**
```
Create API tests for gig wall permissions.

Requirements:
- Import: from rest_framework.test import APITestCase
- Import: from rest_framework import status
- Import: from django.urls import reverse
- Import: from jobs.models import GigPost, GigQuote
- Import: from accounts.models import User
- Import: from businesses.models import Organization, OrganizationMembership

Create TestGigAPI(APITestCase):

def setUp(self):
    self.customer = User.objects.create_user(
        email='customer@test.com',
        full_name='Customer',
        password='pass123'
    )
    self.provider_user = User.objects.create_user(
        email='provider@test.com',
        full_name='Provider',
        password='pass123'
    )
    self.org = Organization.objects.create(name='Test Org', slug='test-org')
    OrganizationMembership.objects.create(
        user=self.provider_user,
        organization=self.org,
        role='owner'
    )

def test_customer_can_create_gig_post(self):
    self.client.force_authenticate(user=self.customer)
    data = {
        'title': 'Need help',
        'description': 'Test job',
        'location_city': 'Toronto',
        'search_radius_miles': 25
    }
    response = self.client.post('/api/jobs/gigs/', data)
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)

def test_provider_cannot_create_gig_post(self):
    self.client.force_authenticate(user=self.provider_user)
    data = {...}
    response = self.client.post('/api/jobs/gigs/', data)
    # Should fail because this endpoint is for customers only
    # Providers use /api/jobs/gigs-provider/ (readonly)

def test_provider_can_comment_on_visible_post(self):
    # Create post within provider's service area
    post = GigPost.objects.create(...)
    
    self.client.force_authenticate(user=self.provider_user)
    response = self.client.post(
        f'/api/jobs/gigs/{post.id}/comments/',
        {'body': 'Can I help?'}
    )
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)

def test_provider_can_quote_on_visible_post(self):
    post = GigPost.objects.create(...)
    
    self.client.force_authenticate(user=self.provider_user)
    response = self.client.post(
        f'/api/jobs/gigs/{post.id}/quotes/',
        {'price': 150.00, 'description': 'We can help'}
    )
    self.assertEqual(response.status_code, status.HTTP_201_CREATED)

def test_customer_can_accept_quote_on_own_post(self):
    post = GigPost.objects.create(customer=self.customer, ...)
    quote = GigQuote.objects.create(gig_post=post, organization=self.org, ...)
    
    self.client.force_authenticate(user=self.customer)
    response = self.client.post(f'/api/jobs/gigs/{post.id}/quotes/{quote.id}/accept/')
    self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    quote.refresh_from_db()
    self.assertEqual(quote.status, 'accepted')

def test_customer_cannot_accept_quote_on_others_post(self):
    other_user = User.objects.create_user(...)
    post = GigPost.objects.create(customer=other_user, ...)
    quote = GigQuote.objects.create(...)
    
    self.client.force_authenticate(user=self.customer)
    response = self.client.post(f'/api/jobs/gigs/{post.id}/quotes/{quote.id}/accept/')
    self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

Run tests:
cd backend && .venv/bin/python manage.py test jobs.tests.test_gig_api
```

---

### Task 10.4: Write frontend gig component tests

**File:** `frontend/src/components/gigs/__tests__/GigPostCard.test.js` (example)

**Prompt:**
```
Create Jest tests for gig components.

Requirements:
- Import: import { render, screen, fireEvent } from '@testing-library/react';
- Import: import GigPostCard from '../GigPostCard';

Create tests:

describe('GigPostCard', () => {
  const mockPost = {
    id: 1,
    title: 'Fix leaky faucet',
    description: 'Kitchen faucet is dripping badly and needs urgent repair',
    location_city: 'Toronto',
    location_state: 'ON',
    category_name: 'Plumbing',
    quote_count: 3,
    created_at: '2026-09-15T10:00:00Z',
    status: 'open'
  };

  test('renders post title and description', () => {
    render(<GigPostCard post={mockPost} onClick={() => {}} />);
    expect(screen.getByText('Fix leaky faucet')).toBeInTheDocument();
    expect(screen.getByText(/Kitchen faucet/)).toBeInTheDocument();
  });

  test('shows quote count', () => {
    render(<GigPostCard post={mockPost} onClick={() => {}} />);
    expect(screen.getByText('3 quotes')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<GigPostCard post={mockPost} onClick={handleClick} />);
    fireEvent.click(screen.getByText('Fix leaky faucet'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('shows distance if provided', () => {
    render(<GigPostCard post={mockPost} onClick={() => {}} showDistance distance={5.2} />);
    expect(screen.getByText('5.2 mi')).toBeInTheDocument();
  });
});

Run tests:
cd frontend && npm test -- GigPostCard.test.js

Repeat similar tests for other components:
- GigCommentThread.test.js
- GigQuoteCard.test.js
- GigImageUpload.test.js
```

---

## All Tasks Complete!

You now have **detailed prompts for all 48 tasks** across 7 slices. Each prompt:
- ✅ Is copy-paste ready for low-power models
- ✅ Has clear file paths and requirements
- ✅ Shows expected code structure
- ✅ Includes test commands

**Execution Strategy:**
1. Copy prompt from this file
2. Paste to GPT-3.5 / Claude Haiku / subagent
3. Review generated code
4. Check off task in `GIG_WALL_TASKS.md`
5. Move to next task

**Progress Tracking:**
- Use `GIG_WALL_TASKS.md` to mark completed tasks
- Update progress percentages as you go
- Each slice is independently deployable
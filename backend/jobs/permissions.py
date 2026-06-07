from businesses.models import Organization, OrganizationMembership


def membership_for(user, organization: Organization):
    if not user or not user.is_authenticated:
        return None
    return OrganizationMembership.objects.filter(user=user, organization=organization).first()


def is_org_member(user, organization: Organization) -> bool:
    return membership_for(user, organization) is not None


def is_org_staff(user, organization: Organization) -> bool:
    m = membership_for(user, organization)
    return bool(m and m.can_manage_schedule)

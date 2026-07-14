import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../../components/auth/AuthFormShell';
import ServiceLocationInput, {
  formatServiceAddress,
  parseServiceAddress,
  validateServiceLocationValue,
} from '../../components/customer/ServiceLocationInput';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI, orgProfileAPI, userAPI } from '../../utils/api';
import { applyPostLoginNavigation, isProviderMember } from '../../utils/postLoginRoute';
import {
  hasSkippedProviderOptionalSetup,
  markProviderOptionalSetupSkipped,
  needsOnboarding,
} from '../../utils/profileSetup';
import { firstProviderHome, providerHome } from '../../utils/providerPaths';

export default function ProviderSetupPage() {
  const { orgSlug } = useParams();
  const { user, memberships, setUserFromProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const stepParam = searchParams.get('step');

  const membership = (memberships || []).find((m) => m.organization_slug === orgSlug);
  const isOwner = membership?.role === 'owner';

  const [step, setStep] = useState(stepParam === 'profile' ? 'profile' : 'contact');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bizAddress, setBizAddress] = useState('');
  const [addressCountry, setAddressCountry] = useState(user?.address_country || '');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(isOwner);

  useEffect(() => {
    if (!isOwner || !orgSlug) {
      setLoadingOrg(false);
      return;
    }
    let cancelled = false;
    businessesAPI
      .getPublicStorefront(orgSlug)
      .then((res) => {
        if (cancelled) return;
        const org = res.data?.organization;
        if (!org) return;
        setTagline(org.tagline || '');
        setDescription(org.description || '');
        const existing = formatServiceAddress({
          address1: org.service_address || '',
          city: org.service_city || '',
          province: org.service_state || '',
          postalCode: org.service_postal_code || '',
          country: user?.address_country || '',
        });
        if (existing.trim()) setBizAddress(existing);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOrg(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, orgSlug, user?.address_country]);

  const goHome = (profile = user) => {
    if (profile) setUserFromProfile(profile);
    applyPostLoginNavigation(
      navigate,
      profile || user,
      memberships,
      nextPath || providerHome(orgSlug)
    );
  };

  if (!isProviderMember(memberships)) {
    navigate('/customer', { replace: true });
    return null;
  }

  if (!membership) {
    navigate(firstProviderHome(memberships), { replace: true });
    return null;
  }

  const submitContact = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !phone.trim()) {
      setError('Name and mobile number are required.');
      return;
    }
    if (isOwner) {
      const locationCheck = validateServiceLocationValue(bizAddress);
      if (!locationCheck.valid) {
        setError(locationCheck.error || 'Please enter your business address.');
        return;
      }
    }
    setSaving(true);
    try {
      const { data: profile } = await userAPI.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        address_country: addressCountry,
      });
      if (isOwner) {
        const fields = parseServiceAddress(bizAddress);
        await orgProfileAPI.patchOrganization(orgSlug, {
          service_address: fields.address1.trim(),
          service_city: fields.city.trim(),
          service_state: fields.province.trim(),
          service_postal_code: fields.postalCode.trim(),
        });
      }
      const { data: completed } = await userAPI.completeOnboarding();
      setUserFromProfile(completed || profile);

      const skipOptional = hasSkippedProviderOptionalSetup(orgSlug);
      const hasProfileBits = Boolean(tagline.trim() || description.trim());
      if (isOwner && !skipOptional && !hasProfileBits) {
        setStep('profile');
      } else {
        goHome(completed || profile);
      }
    } catch (err) {
      const d = err.response?.data;
      setError(d?.detail || d?.phone?.[0] || d?.full_name?.[0] || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  const submitOptional = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, {
        tagline: tagline.trim(),
        description: description.trim(),
      });
      markProviderOptionalSetupSkipped(orgSlug);
      goHome();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const skipOptional = () => {
    markProviderOptionalSetupSkipped(orgSlug);
    goHome();
  };

  // Contact already done — go home (optional step uses its own Continue/Skip)
  if (!needsOnboarding(user) && step === 'contact') {
    return <Navigate to={nextPath && nextPath.startsWith('/') ? nextPath : providerHome(orgSlug)} replace />;
  }

  if (loadingOrg) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#d8f3ef] text-slate-600">
        Loading…
      </div>
    );
  }

  if (step === 'profile') {
    return (
      <AuthFormShell
        title="Public profile (optional)"
        subtitle="Add a short intro customers see on your page. You can skip and finish this later on My page."
        backTo={providerHome(orgSlug)}
      >
        <form onSubmit={submitOptional} className="space-y-4">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="tagline" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tagline
            </label>
            <input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Reliable cleaning in Ottawa"
              className="lx-input"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-slate-700">
              About your business
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who you serve, what you’re known for…"
              className="lx-input min-h-[112px] py-3"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & continue'}
          </button>
          <button
            type="button"
            onClick={skipOptional}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Skip for now
          </button>
        </form>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      title="Set up your account"
      subtitle={
        isOwner
          ? 'Add your contact details and business address so customers and your team can reach you.'
          : 'Add your name and mobile so the business can reach you.'
      }
      backTo="/login"
    >
      <form onSubmit={submitContact} className="space-y-4">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="prov-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="prov-name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="lx-input"
          />
        </div>
        <div>
          <label htmlFor="prov-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="prov-email"
            value={user?.email || ''}
            readOnly
            className="lx-input bg-slate-50 text-slate-600"
          />
        </div>
        <div>
          <label htmlFor="prov-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mobile number
          </label>
          <input
            id="prov-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
            className="lx-input"
          />
        </div>
        {isOwner && (
          <ServiceLocationInput
            id="prov-biz-address"
            value={bizAddress}
            onChange={setBizAddress}
            country={addressCountry}
            onCountryChange={setAddressCountry}
            label="Business address"
            hint="Office or home base for your business."
          />
        )}
        <button
          type="submit"
          disabled={saving}
          className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthFormShell>
  );
}

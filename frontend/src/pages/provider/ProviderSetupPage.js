import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AuthFormShell from '../../components/auth/AuthFormShell';
import ServiceLocationInput, {
  formatServiceAddress,
  parseServiceAddress,
  validateServiceLocationValue,
} from '../../components/customer/ServiceLocationInput';
import {
  detectTimezone,
  formatTimezoneLabel,
  listTimezones,
} from '../../components/provider/OrganizationTimezoneField';
import ProviderServiceAreaSettings from '../../components/provider/ProviderServiceAreaSettings';
import DateRangeControl from '../../components/scheduling/DateRangeControl';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI, jobsAPI, orgProfileAPI, userAPI } from '../../utils/api';
import { formatLocalDateKey } from '../../utils/dateRange';
import parseApiError from '../../utils/parseApiError';
import { applyPostLoginNavigation, isProviderMember } from '../../utils/postLoginRoute';
import {
  hasFinishedProviderSetupWizard,
  markProviderSetupWizardDone,
  needsOnboarding,
  nextProviderWizardStep,
  PROVIDER_WIZARD_STEPS,
} from '../../utils/profileSetup';
import {
  firstProviderHome,
  providerHome,
  providerServices,
  providerSettings,
} from '../../utils/providerPaths';

const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

const DEFAULT_BLOCK = { weekday: 0, start_time: '09:00', end_time: '17:00', is_active: true };

function defaultDateRange() {
  const from = new Date();
  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  return { from: formatLocalDateKey(from), until: formatLocalDateKey(until) };
}

function WizardProgress({ step }) {
  const idx = PROVIDER_WIZARD_STEPS.indexOf(step);
  if (idx < 0) return null;
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-teal-800/70">
      Step {idx + 1} of {PROVIDER_WIZARD_STEPS.length} · optional
    </p>
  );
}

export default function ProviderSetupPage() {
  const { orgSlug } = useParams();
  const { user, memberships, setUserFromProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const stepParam = searchParams.get('step');

  const membership = (memberships || []).find((m) => m.organization_slug === orgSlug);
  const isOwner = membership?.role === 'owner';

  const initialStep = useMemo(() => {
    if (stepParam && PROVIDER_WIZARD_STEPS.includes(stepParam)) return stepParam;
    if (stepParam === 'profile') return 'profile';
    return 'contact';
  }, [stepParam]);

  const [step, setStep] = useState(initialStep);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bizAddress, setBizAddress] = useState('');
  const [addressCountry, setAddressCountry] = useState(user?.address_country || '');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('flexi');
  const [timezone, setTimezone] = useState(() => detectTimezone() || 'America/New_York');
  const [validFrom, setValidFrom] = useState(() => defaultDateRange().from);
  const [validUntil, setValidUntil] = useState(() => defaultDateRange().until);
  const [blocks, setBlocks] = useState(
    () => [0, 1, 2, 3, 4].map((wd) => ({ ...DEFAULT_BLOCK, weekday: wd }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(isOwner);

  const tzOptions = useMemo(() => {
    const all = listTimezones();
    return timezone && !all.includes(timezone) ? [timezone, ...all] : all;
  }, [timezone]);

  useEffect(() => {
    if (stepParam && (PROVIDER_WIZARD_STEPS.includes(stepParam) || stepParam === 'contact')) {
      setStep(stepParam === 'contact' ? 'contact' : stepParam);
    }
  }, [stepParam]);

  useEffect(() => {
    if (!isOwner || !orgSlug) {
      setLoadingOrg(false);
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      businessesAPI.getPublicStorefront(orgSlug),
      jobsAPI.getSchedulingSettings(orgSlug).catch(() => null),
    ])
      .then(([storeRes, schedRes]) => {
        if (cancelled) return;
        const org = storeRes.data?.organization;
        if (org) {
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
        }
        const d = schedRes?.data;
        if (d) {
          setMode(d.scheduling_mode || 'flexi');
          if (d.timezone) setTimezone(d.timezone);
          const defaults = defaultDateRange();
          setValidFrom(d.schedule_valid_from || defaults.from);
          setValidUntil(d.schedule_valid_until || defaults.until);
          const list = d.weekly_blocks || [];
          if (list.length) {
            setBlocks(
              list.map((b) => ({
                weekday: b.weekday,
                start_time: b.start_time?.slice(0, 5) || '09:00',
                end_time: b.end_time?.slice(0, 5) || '17:00',
                is_active: b.is_active,
              }))
            );
          }
        }
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

  const finishWizard = (profile) => {
    markProviderSetupWizardDone(orgSlug);
    goHome(profile);
  };

  const goNextWizardStep = (fromStep) => {
    const next = nextProviderWizardStep(fromStep);
    if (next) setStep(next);
    else finishWizard();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#d8f3ef] text-slate-600">
        Loading…
      </div>
    );
  }

  if (!isProviderMember(memberships)) {
    return <Navigate to="/customer" replace />;
  }

  if (!membership) {
    return <Navigate to={firstProviderHome(memberships)} replace />;
  }

  // Contact already done — only allow optional wizard steps
  if (!needsOnboarding(user) && step === 'contact') {
    if (isOwner && !hasFinishedProviderSetupWizard(orgSlug) && !stepParam) {
      return <Navigate to={`/provider/${orgSlug}/setup?step=availability`} replace />;
    }
    const fallback = nextPath && nextPath.startsWith('/') ? nextPath : providerHome(orgSlug);
    return <Navigate to={fallback} replace />;
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

      if (isOwner && !hasFinishedProviderSetupWizard(orgSlug)) {
        setStep('availability');
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

  const submitAvailability = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'recurring') {
      if (validFrom && validUntil && validFrom > validUntil) {
        setError('End date must be on or after start date.');
        return;
      }
      if (blocks.length === 0) {
        setError('Select at least one weekday for your weekly schedule.');
        return;
      }
    }
    setSaving(true);
    try {
      await jobsAPI.saveSchedulingSettings(orgSlug, {
        scheduling_mode: mode,
        timezone: timezone || detectTimezone() || 'America/New_York',
        schedule_valid_from: mode === 'recurring' ? validFrom || null : null,
        schedule_valid_until: mode === 'recurring' ? validUntil || null : null,
        weekly_blocks:
          mode === 'recurring'
            ? blocks.map((b) => ({
                weekday: b.weekday,
                start_time: b.start_time.length === 5 ? `${b.start_time}:00` : b.start_time,
                end_time: b.end_time.length === 5 ? `${b.end_time}:00` : b.end_time,
                is_active: true,
              }))
            : [],
      });
      goNextWizardStep('availability');
    } catch (err) {
      setError(parseApiError(err) || 'Could not save availability.');
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await orgProfileAPI.patchOrganization(orgSlug, {
        tagline: tagline.trim(),
        description: description.trim(),
      });
      finishWizard();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (weekday) => {
    const existing = blocks.find((b) => b.weekday === weekday);
    if (existing) {
      setBlocks(blocks.filter((b) => b.weekday !== weekday));
    } else {
      setBlocks([...blocks, { ...DEFAULT_BLOCK, weekday }].sort((a, b) => a.weekday - b.weekday));
    }
  };

  const updateBlockTime = (weekday, field, value) => {
    setBlocks(blocks.map((b) => (b.weekday === weekday ? { ...b, [field]: value } : b)));
  };

  const isDayActive = (weekday) => blocks.some((b) => b.weekday === weekday);

  if (loadingOrg) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#d8f3ef] text-slate-600">
        Loading…
      </div>
    );
  }

  if (step === 'availability' && isOwner) {
    const detectedTz = detectTimezone();
    return (
      <AuthFormShell
        title="How do you take bookings?"
        subtitle="Choose weekly hours that auto-open slots, or Flexi where you open dates yourself. You can change this anytime in Settings."
        backTo={providerHome(orgSlug)}
      >
        <WizardProgress step="availability" />
        <form onSubmit={submitAvailability} className="space-y-4">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('recurring')}
              className={`min-h-[56px] rounded-xl border-2 p-3 text-left text-sm ${
                mode === 'recurring' ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
              }`}
            >
              <span className="font-semibold text-slate-900">Weekly schedule</span>
              <span className="mt-0.5 block text-xs text-slate-600">Same hours each week</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('flexi')}
              className={`min-h-[56px] rounded-xl border-2 p-3 text-left text-sm ${
                mode === 'flexi' ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
              }`}
            >
              <span className="font-semibold text-slate-900">Flexi</span>
              <span className="mt-0.5 block text-xs text-slate-600">Open specific dates yourself</span>
            </button>
          </div>

          <div>
            <label htmlFor="setup-timezone" className="mb-1.5 block text-sm font-medium text-slate-700">
              Timezone
            </label>
            <p className="mb-2 text-xs text-slate-500">Weekly hours and slots use this timezone.</p>
            <select
              id="setup-timezone"
              value={timezone || 'America/New_York'}
              onChange={(e) => setTimezone(e.target.value)}
              className="lx-input min-h-[44px]"
            >
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {formatTimezoneLabel(tz)}
                </option>
              ))}
            </select>
            {detectedTz && detectedTz !== timezone && (
              <button
                type="button"
                onClick={() => setTimezone(detectedTz)}
                className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                Use detected: {formatTimezoneLabel(detectedTz)}
              </button>
            )}
          </div>

          {mode === 'recurring' && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Date range</p>
                <p className="mb-2 text-xs text-slate-500">
                  Open slots are auto-generated only inside this range.
                </p>
                <DateRangeControl
                  from={validFrom}
                  until={validUntil}
                  onChange={({ from, until }) => {
                    setValidFrom(from);
                    setValidUntil(until);
                  }}
                  maxSpanDays={365}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Weekly hours</p>
                <p className="mb-2 text-xs text-slate-500">
                  Pick working days and start/end times for each day.
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`min-h-[40px] min-w-[48px] rounded-lg text-sm font-medium ${
                        isDayActive(d.value)
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {blocks.map((b) => {
                    const label = WEEKDAYS.find((d) => d.value === b.weekday)?.label || '';
                    return (
                      <div key={b.weekday} className="flex items-center gap-2 text-sm">
                        <span className="w-10 font-medium text-slate-700">{label}</span>
                        <input
                          type="time"
                          value={b.start_time}
                          onChange={(e) => updateBlockTime(b.weekday, 'start_time', e.target.value)}
                          className="lx-input min-h-[40px] flex-1"
                          aria-label={`${label} start time`}
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          value={b.end_time}
                          onChange={(e) => updateBlockTime(b.weekday, 'end_time', e.target.value)}
                          className="lx-input min-h-[40px] flex-1"
                          aria-label={`${label} end time`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {mode === 'flexi' && (
            <p className="rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2 text-sm text-slate-700">
              After setup, open bookable times on{' '}
              <Link to={providerSettings(orgSlug)} className="font-semibold text-teal-700">
                Settings
              </Link>{' '}
              or Schedule.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="lx-btn-primary w-full min-h-[48px] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & continue'}
          </button>
          <button
            type="button"
            onClick={() => goNextWizardStep('availability')}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => finishWizard()}
            className="w-full text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Skip remaining setup
          </button>
        </form>
      </AuthFormShell>
    );
  }

  if (step === 'service_area' && isOwner) {
    return (
      <AuthFormShell
        title="Where do you serve?"
        subtitle="Add a service location and radius so nearby customers can find you. Same controls as Settings — you can refine this later."
        backTo={providerHome(orgSlug)}
      >
        <WizardProgress step="service_area" />
        <div className="space-y-4">
          <ProviderServiceAreaSettings orgSlug={orgSlug} isOwner={isOwner} />
          <button
            type="button"
            onClick={() => goNextWizardStep('service_area')}
            className="lx-btn-primary w-full min-h-[48px]"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => goNextWizardStep('service_area')}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => finishWizard()}
            className="w-full text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Skip remaining setup
          </button>
        </div>
      </AuthFormShell>
    );
  }

  if (step === 'services' && isOwner) {
    return (
      <AuthFormShell
        title="Add your services"
        subtitle="Customers book from your catalog. Add at least one service when you’re ready — you can do it now or later."
        backTo={providerHome(orgSlug)}
      >
        <WizardProgress step="services" />
        <div className="space-y-4">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-4 text-sm text-slate-700">
            Examples: house cleaning, haircut, plumbing visit. Set duration and price on the Services
            page.
          </div>
          <Link
            to={providerServices(orgSlug)}
            className="lx-btn-primary flex w-full min-h-[48px] items-center justify-center"
          >
            Go to Services
          </Link>
          <button
            type="button"
            onClick={() => goNextWizardStep('services')}
            className="w-full min-h-[44px] text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => finishWizard()}
            className="w-full text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Skip remaining setup
          </button>
        </div>
      </AuthFormShell>
    );
  }

  if (step === 'profile' && isOwner) {
    return (
      <AuthFormShell
        title="Public profile (optional)"
        subtitle="Add a short intro customers see on your page. You can finish this later on My page."
        backTo={providerHome(orgSlug)}
      >
        <WizardProgress step="profile" />
        <form onSubmit={submitProfile} className="space-y-4">
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
            {saving ? 'Saving…' : 'Save & finish'}
          </button>
          <button
            type="button"
            onClick={() => finishWizard()}
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

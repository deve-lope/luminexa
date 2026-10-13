/** Provider Training library — text lessons + spotlight steps (no video, no AI). */

/**
 * @param {string} orgSlug
 * @param {{ includeGigs?: boolean }} [opts]
 */
export function buildProviderTrainingLessons(orgSlug, { includeGigs = true } = {}) {
  const base = orgSlug ? `/provider/${orgSlug}` : '/provider';

  /** Full day-in-the-life walkthrough — featured first. */
  const walkthrough = {
    id: 'full-job-walkthrough',
    title: 'Full walkthrough: service → job → complete',
    summary:
      'Best path end to end: Home dashboard, create a service, book a customer, task, reschedule, timeline, questions (and how the customer answers), reminders, on my way, start and finish.',
    featured: true,
    openPath: base,
    sections: [
      {
        heading: '1. Home — what you see',
        body: 'Open Home (Today). This is your command center.',
        bullets: [
          'Top stats: Today (how many jobs today), Upcoming (jumps to Schedule), Requests (pending bookings + inquiries).',
          'Tasks block: open to-dos, Add task, link to All tasks.',
          'Jobs block: today’s and upcoming bookings — tap a card to open the job.',
          'Attention: requests waiting for you, plus notification cards you can dismiss.',
          'Manage your business: shortcuts to Analytics, Services, Schedule, My page, Settings.',
        ],
      },
      {
        heading: '2. Tabs you’ll use every day',
        body: 'Bottom bar on phone (sidebar on desktop):',
        bullets: [
          'Home — dashboard above.',
          'Schedule — open times + Book for a customer + day timeline.',
          'Requests — new bookings and inquiries to accept or reply.',
          'Messages — chat threads with customers.',
          'Menu — Jobs list, Services, Clients, Notifications, Training, and more.',
        ],
      },
      {
        heading: '3. Create what customers book (service under a category)',
        body: 'In Luminexa, a “service” is the catalog item (under a category). A “job” on Home is a booked appointment.',
        bullets: [
          'Menu → Services → + Add services.',
          'Fill name, Category (pick a platform category), duration, price, then Add service.',
          'That service now appears when you book for a customer and on your public page.',
        ],
      },
      {
        heading: '4. Book that service for a customer (creates the job)',
        body: 'Go to Schedule, pick a day, then Book for a customer.',
        bullets: [
          'Choose time, pick the Service you created, enter a new customer or choose an existing client.',
          'Optional notes → Book appointment.',
          'The customer gets an invite to confirm. After they confirm, it shows on Home → Jobs and on the day timeline.',
        ],
      },
      {
        heading: '5. Add a task related to that job',
        body: 'Prep work (parts, call ahead, materials) belongs on a task linked to the booking.',
        bullets: [
          'From Home: Add task, or open the job → Tasks → Add task.',
          'Or go to /tasks/new?job=… (the app fills “Linked to job” when you start from a booking).',
          'Write the task, set Complete by, Save task. It appears on Home Tasks and on the job.',
        ],
      },
      {
        heading: '6. Reschedule the job',
        body: 'Plans change — keep the calendar honest.',
        bullets: [
          'Open the booking (Home job card, Schedule day, or Schedule → booking detail).',
          'Tap Reschedule or Change time.',
          'Pick a new open slot; optional reason for the customer. They get notified.',
        ],
      },
      {
        heading: '7. Check it on the timeline',
        body: 'On Schedule for that day:',
        bullets: [
          'Day strip / Interactive timeline: segments show Booked, Pending, Available, Unavailable.',
          'Jobs this day list under the calendar — tap a card for details.',
          'On the booking detail, Activity shows history (created, accepted, rescheduled, started, complete).',
        ],
      },
      {
        heading: '8. Ask the customer questions — and how they answer',
        body: 'Use this when you need details before you accept or quote. No AI — real in-app questions.',
        bullets: [
          'Provider: open Requests → that booking → Ask questions → + Add question → Send questions to customer.',
          'Customer (what they see): on their booking they get Questions from the business → fill answers → Submit answers.',
          'You see Waiting for answers… then Answers received / Customer answers on the same request screen.',
          'For free chat (not structured questions): use the thread on the request or the Messages tab — same conversation from both sides.',
        ],
      },
      {
        heading: '9. Before job time — reminders',
        body: 'The app nudges both sides so nothing is forgotten.',
        bullets: [
          'You: incomplete tasks linked to the job (about 48h before) and task-due reminders — check Home cards and Menu → Notifications (often Review tasks → Jobs).',
          'Customer: email reminder about a day before the appointment.',
          'Clear open tasks on Home before you leave so prep is done.',
        ],
      },
      {
        heading: '10. Share location (“I’m on my way”)',
        body: 'On the phone app only (not the desktop browser), open the confirmed booking near start time.',
        bullets: [
          'Within about 6 hours of start: tap I’m on my way — customer is notified and can follow updates.',
          'You’ll see Sharing location with customer; Stop sharing if you need to cancel the share.',
          'Location sharing clears when you start or complete the job.',
        ],
      },
      {
        heading: '11. Start job → end job',
        body: 'Same booking detail screen, when the window opens (from ~6 hours before start):',
        bullets: [
          'Start job — status moves to in progress; Activity updates.',
          'When finished: Mark complete → complete & invoice / issue as prompted.',
          'Other options if needed: Incomplete — return visit, or Customer no-show.',
          'Finished work also appears under Menu → Jobs → Completed.',
        ],
      },
      {
        heading: 'Quick practice order',
        bullets: [
          'Home → note stats, Tasks, Jobs.',
          'Menu → Services → add a categorized service.',
          'Schedule → Book for a customer with that service.',
          'Open the job → Add task → Reschedule → check day timeline.',
          'Requests → Ask questions (then confirm answers as the customer on their booking).',
          'Near start: notifications → I’m on my way (app) → Start job → Mark complete.',
        ],
      },
    ],
    spotlightSteps: [
      {
        id: 'wt-home',
        title: 'Home dashboard',
        body: 'Start here — stats, Tasks, Jobs, and shortcuts.',
        target: 'tab-today',
        path: base,
      },
      {
        id: 'wt-schedule',
        title: 'Schedule',
        body: 'Book for a customer and check the day timeline here.',
        target: 'tab-schedule',
        path: base,
      },
      {
        id: 'wt-requests',
        title: 'Requests',
        body: 'Accept work and Ask questions to the customer here.',
        target: 'tab-requests',
        path: base,
      },
      {
        id: 'wt-messages',
        title: 'Messages',
        body: 'Free-form chat with customers lives here.',
        target: 'tab-messages',
        path: base,
      },
      {
        id: 'wt-menu',
        title: 'Menu',
        body: 'Services, Jobs, Notifications, and Training are under the menu.',
        target: 'menu',
        path: base,
      },
      {
        id: 'wt-services',
        title: 'Services catalog',
        body: 'Create a service under a category with + Add services.',
        path: `${base}/services`,
      },
      {
        id: 'wt-schedule-page',
        title: 'Book & timeline',
        body: 'Pick a day → Book for a customer. Booked slots show on the timeline.',
        path: `${base}/schedule`,
      },
      {
        id: 'wt-jobs',
        title: 'Jobs list',
        body: 'Accepted bookings — upcoming and completed — live under Jobs.',
        path: `${base}/jobs`,
      },
    ],
  };

  const lessons = [
    walkthrough,
    {
      id: 'home',
      title: 'Home (Today) — deep dive',
      summary:
        'Everything on the dashboard: stats, Tasks, Jobs, requests needing attention, and business shortcuts.',
      openPath: base,
      sections: [
        {
          heading: 'Top dashboard tiles',
          bullets: [
            'Today — count of jobs for today.',
            'Upcoming — opens Schedule so you can plan ahead.',
            'Requests — pending booking requests and customer inquiries waiting on you.',
          ],
        },
        {
          heading: 'Tasks on Home',
          bullets: [
            'Open tasks listed with due info; check them off when done.',
            'Add task — create a new to-do (optionally link to a job).',
            'All tasks — full list; Done · last 2 days for recent completions.',
          ],
        },
        {
          heading: 'Jobs on Home',
          bullets: [
            'Cards for today and upcoming — customer, service, time.',
            'Tap a card → booking detail (start/complete, tasks, reschedule).',
            'Empty state: “No jobs today or upcoming.” Overdue hint if start time passed.',
            'Needs return visit — incomplete jobs that need a follow-up.',
          ],
        },
        {
          heading: 'Tabs from Home',
          bullets: [
            'Schedule, Requests, Messages — primary tabs for day-to-day work.',
            'Menu — Jobs, Services, Clients, Notifications, Training, Settings, My page.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'home-tab',
          title: 'Home',
          body: 'Tap Home anytime to return to this dashboard.',
          target: 'tab-today',
          path: base,
        },
        {
          id: 'home-schedule-tab',
          title: 'Schedule tab',
          body: 'Jump to open times and Book for a customer.',
          target: 'tab-schedule',
          path: base,
        },
        {
          id: 'home-requests-tab',
          title: 'Requests tab',
          body: 'Pending bookings and inquiries land here.',
          target: 'tab-requests',
          path: base,
        },
        {
          id: 'home-messages-tab',
          title: 'Messages tab',
          body: 'Open chats with customers.',
          target: 'tab-messages',
          path: base,
        },
      ],
    },
    {
      id: 'schedule',
      title: 'Schedule & timeline',
      summary: 'Open times, Book for a customer, day timeline, and job detail.',
      openPath: `${base}/schedule`,
      sections: [
        {
          heading: 'Book for a customer',
          bullets: [
            'Pick a day → Book for a customer.',
            'Set time, choose Service, new or existing customer → Book appointment.',
          ],
        },
        {
          heading: 'Timeline',
          bullets: [
            'Day bar shows Booked / Pending / Available / Unavailable.',
            'Jobs this day lists cards — tap to open detail.',
            'Booking detail → Activity timeline for status history.',
          ],
        },
        {
          heading: 'Reschedule',
          body: 'On booking detail: Reschedule / Change time → new slot → customer notified.',
        },
      ],
      spotlightSteps: [
        {
          id: 'schedule-tab',
          title: 'Schedule',
          body: 'Tap Schedule to open your calendar and timeline.',
          target: 'tab-schedule',
          path: base,
        },
        {
          id: 'schedule-page',
          title: 'Your calendar',
          body: 'Book for a customer and check Jobs this day here.',
          path: `${base}/schedule`,
        },
      ],
    },
    {
      id: 'requests',
      title: 'Requests & customer questions',
      summary: 'Accept work, Ask questions, and see how the customer answers.',
      openPath: `${base}/requests`,
      sections: [
        {
          heading: 'Inbox',
          bullets: [
            'Pending bookings and inquiries need Accept / reply.',
            'Badge on Requests = unseen items.',
          ],
        },
        {
          heading: 'Ask questions (provider)',
          bullets: [
            'Open the booking request → Ask questions → Add question → Send questions to customer.',
            'Status: Waiting for answers… then Answers received.',
          ],
        },
        {
          heading: 'Customer answers (what they do)',
          bullets: [
            'Customer opens their booking → Questions from the business.',
            'They fill each answer → Submit answers.',
            'You review Customer answers on the request screen (or continue in the chat thread).',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'requests-tab',
          title: 'Requests',
          body: 'Tap Requests for new bookings and Ask questions.',
          target: 'tab-requests',
          path: base,
        },
        {
          id: 'requests-page',
          title: 'Service requests',
          body: 'Open a booking here to ask questions or accept.',
          path: `${base}/requests`,
        },
      ],
    },
    {
      id: 'messages',
      title: 'Messages',
      summary: 'Chat with customers about bookings, quotes, and job details.',
      openPath: `${base}/messages`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Confirm timing, access, and job details before you arrive.',
            'Threads also open from a request’s Chat with the customer area.',
            'Watch the unread badge so nothing sits unanswered.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'messages-tab',
          title: 'Messages',
          body: 'Tap Messages to open your chats.',
          target: 'tab-messages',
          path: base,
        },
        {
          id: 'messages-page',
          title: 'Inbox',
          body: 'Conversations with customers are listed here.',
          path: `${base}/messages`,
        },
      ],
    },
    {
      id: 'services',
      title: 'Services (catalog by category)',
      summary: 'Create bookable services under a category — this is what customers book.',
      openPath: `${base}/services`,
      sections: [
        {
          heading: 'Create under a category',
          bullets: [
            '+ Add services → set Category, name, duration, price → Add service.',
            'Filter by category chips on the catalog list.',
            'Keep only active services you actually offer.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'services-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then Services (under Business).',
          target: 'menu',
          path: base,
        },
        {
          id: 'services-page',
          title: 'Services catalog',
          body: 'Add a service under a category with + Add services.',
          path: `${base}/services`,
        },
      ],
    },
    {
      id: 'jobs-and-tasks',
      title: 'Jobs, tasks, start & complete',
      summary:
        'Link tasks to a job, get reminders, share location on the way, start and mark complete.',
      openPath: `${base}/jobs`,
      sections: [
        {
          heading: 'Jobs list',
          body: 'Menu → Jobs: accepted bookings — Upcoming and Completed filters.',
        },
        {
          heading: 'Tasks on a job',
          bullets: [
            'Booking detail → Tasks → Add task (or Home → Add task with Link to job).',
            '~48h before: reminder if tasks are still incomplete — Notifications / Home.',
          ],
        },
        {
          heading: 'On my way → start → complete',
          bullets: [
            'Phone app, confirmed booking, ~6h before start: I’m on my way (location share).',
            'Start job → work → Mark complete (invoice as prompted).',
            'Also: Incomplete — return visit, or Customer no-show when needed.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'jobs-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then Jobs.',
          target: 'menu',
          path: base,
        },
        {
          id: 'jobs-page',
          title: 'Jobs',
          body: 'Upcoming and completed bookings — open one for tasks and Start job.',
          path: `${base}/jobs`,
        },
        {
          id: 'tasks-new',
          title: 'Add a task',
          body: 'Create a task here; link it to a job when you can.',
          path: `${base}/tasks/new`,
        },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      summary: 'Booking rules, service area, capacity, and business details.',
      openPath: `${base}/settings`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Set service area / radius so the right customers find you.',
            'Adjust booking policy and how many jobs you take at once.',
            'Keep contact and business info up to date.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'settings-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then Settings.',
          target: 'menu',
          path: base,
        },
        {
          id: 'settings-page',
          title: 'Settings',
          body: 'Booking policy, service area, and business options live here.',
          path: `${base}/settings`,
        },
      ],
    },
    {
      id: 'my-page',
      title: 'My page',
      summary: 'Your public booking link to share with customers.',
      openPath: `${base}/my-page`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Copy and share your booking link.',
            'Preview how customers see your services.',
            'Finish Services and Settings first so the page looks complete.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'mypage-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then My page.',
          target: 'menu',
          path: base,
        },
        {
          id: 'mypage-page',
          title: 'My page',
          body: 'Share this link so customers can book you directly.',
          path: `${base}/my-page`,
        },
      ],
    },
    {
      id: 'clients',
      title: 'Clients',
      summary: 'People who book you — approve, import, and review history.',
      openPath: `${base}/clients`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Approve pending clients if your settings require it.',
            'Open a client for history; import a CSV when bringing customers over.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'clients-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then Clients.',
          target: 'menu',
          path: base,
        },
        {
          id: 'clients-page',
          title: 'Clients',
          body: 'Manage who can book you from this list.',
          path: `${base}/clients`,
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics & books',
      summary: 'Activity and bookkeeping-related info over time.',
      openPath: `${base}/analytics`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Open from Menu when you want totals and trends.',
            'Day-to-day work still lives on Home, Schedule, and Jobs.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'analytics-menu',
          title: 'Open the menu',
          body: 'Tap the menu, then Analytics & books.',
          target: 'menu',
          path: base,
        },
        {
          id: 'analytics-page',
          title: 'Analytics & books',
          body: 'Review activity and books-related info here.',
          path: `${base}/analytics`,
        },
      ],
    },
  ];

  if (includeGigs) {
    const gigsLesson = {
      id: 'gigs',
      title: 'Gig wall',
      summary: 'Browse open customer gigs nearby and send bids.',
      openPath: `${base}/gigs`,
      sections: [
        {
          heading: 'What to do',
          bullets: [
            'Browse open gigs in your area and send a clear bid.',
            'Track bids under Gig wall → My bids.',
          ],
        },
      ],
      spotlightSteps: [
        {
          id: 'gigs-tab',
          title: 'Gig wall',
          body: 'Tap Gig wall (or Menu → Gig wall) to browse open jobs.',
          target: 'tab-gigs',
          path: base,
        },
        {
          id: 'gigs-page',
          title: 'Open gigs',
          body: 'Browse and bid on gigs from this screen.',
          path: `${base}/gigs`,
        },
      ],
    };
    const insertAt = lessons.findIndex((l) => l.id === 'messages') + 1;
    lessons.splice(insertAt, 0, gigsLesson);
  }

  return lessons;
}

export function getProviderTrainingLesson(orgSlug, lessonId, opts = {}) {
  return buildProviderTrainingLessons(orgSlug, opts).find((l) => l.id === lessonId) || null;
}

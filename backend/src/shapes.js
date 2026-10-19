// Converts database rows into the JSON the frontend expects.

export function courseShape(r) {
  return {
    id: r.id,
    tutorId: r.tutor_id,
    title: r.title,
    description: r.description,
    subject: r.subject,
    totalSessions: r.total_sessions,
    sessionsPerWeek: r.sessions_per_week,
    sessionMinutes: r.session_minutes,
    priceCents: r.price_cents,
    perSessionCents: Math.round(r.price_cents / r.total_sessions),
    weeks: Math.ceil(r.total_sessions / r.sessions_per_week),
    status: r.status,
    tutorName: r.tutor_name,
    tutorHeadline: r.tutor_headline,
    tutorRating: r.tutor_rating === undefined ? undefined : Number(r.tutor_rating),
    tutorReviewCount: r.tutor_review_count,
    enrolled: r.enrolled,
  };
}

// Shared SELECT for courses with their tutor's name and rating attached.
export const COURSE_SELECT = `
  select c.id, c.tutor_id, c.title, c.description, c.subject, c.total_sessions, c.sessions_per_week,
         c.session_minutes, c.price_cents, c.status, c.created_at,
         u.name as tutor_name, p.headline as tutor_headline,
         coalesce(rt.avg_rating, 0) as tutor_rating,
         coalesce(rt.review_count, 0) as tutor_review_count,
         (select count(*)::int from enrollments e
           where e.course_id = c.id and e.status in ('active', 'completed')) as enrolled
  from courses c
  join users u on u.id = c.tutor_id
  left join tutor_profiles p on p.user_id = c.tutor_id
  left join (
    select tutor_id, round(avg(rating)::numeric, 2)::float8 as avg_rating, count(*)::int as review_count
    from reviews group by tutor_id
  ) rt on rt.tutor_id = c.tutor_id
`;

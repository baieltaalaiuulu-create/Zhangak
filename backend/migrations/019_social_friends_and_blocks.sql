-- Friendship is opt-in and has no direct messages.  Blocking always wins and
-- removes the relationship, so social discovery cannot bypass a learner's
-- privacy choices.

CREATE TABLE student_social_friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_social_friendships_distinct CHECK (requester_id <> recipient_id),
  CONSTRAINT student_social_friendships_status CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'))
);

CREATE UNIQUE INDEX student_social_friendships_active_pair
  ON student_social_friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id))
  WHERE status IN ('pending', 'accepted');

CREATE INDEX student_social_friendships_incoming
  ON student_social_friendships (recipient_id, status, created_at DESC);
CREATE INDEX student_social_friendships_outgoing
  ON student_social_friendships (requester_id, status, created_at DESC);

CREATE TABLE student_social_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT student_social_blocks_distinct CHECK (blocker_id <> blocked_id)
);

CREATE INDEX student_social_blocks_blocked ON student_social_blocks (blocked_id, blocker_id);

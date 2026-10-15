import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateManualPracticeSession, useUpdatePracticeSession } from '@workspace/api-client-react';
import type { PracticeCategory, PracticeSession, PracticeSessionManualInput, RepertoirePiece } from '@workspace/api-client-react';
import { Button, Field, Modal, SubmitButton } from '@/components/Primitives';
import { Form } from '@/components/ui/form';
import { titleCase } from '@/lib/utils';

const categories: PracticeCategory[] = [
  'technique',
  'scales',
  'intonation',
  'bowing',
  'sight-reading',
  'repertoire',
  'memorisation',
  'other',
];

type FormValues = {
  practiceDate: string;
  durationMinutes: string;
  durationHours: string;
  durationRemainder: string;
  pieceId: string;
  category: PracticeCategory;
  goal: string;
  notes: string;
  focusAreas: string;
};

export function ManualPracticeDialog({
  session,
  defaultDate,
  todayKey,
  repertoire,
  onClose,
  onSaved,
}: {
  session?: PracticeSession;
  defaultDate: string;
  todayKey: string;
  repertoire: RepertoirePiece[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [durationMode, setDurationMode] = useState<'minutes' | 'hours-minutes'>('minutes');
  const [durationError, setDurationError] = useState('');
  const [focusError, setFocusError] = useState('');
  const create = useCreateManualPracticeSession();
  const update = useUpdatePracticeSession();
  const initialMinutes = session
    ? Math.max(1, Math.round(session.elapsedSeconds / 60))
    : 0;
  const form = useForm<FormValues>({
    defaultValues: {
      practiceDate: session?.practiceDate ?? defaultDate,
      durationMinutes: initialMinutes ? String(initialMinutes) : '',
      durationHours: String(Math.floor(initialMinutes / 60)),
      durationRemainder: String(initialMinutes % 60),
      pieceId: session?.pieceId ? String(session.pieceId) : '',
      category: session?.category ?? 'technique',
      goal: session?.goal ?? '',
      notes: session?.notes ?? '',
      focusAreas: session?.focusAreas.join(', ') ?? '',
    },
  });

  const changeDurationMode = (nextMode: 'minutes' | 'hours-minutes') => {
    const current = form.getValues();
    if (nextMode === 'hours-minutes') {
      const total = Math.max(0, Number(current.durationMinutes) || 0);
      form.setValue('durationHours', String(Math.floor(total / 60)));
      form.setValue('durationRemainder', String(total % 60));
    } else {
      const total =
        (Number(current.durationHours) || 0) * 60 +
        (Number(current.durationRemainder) || 0);
      form.setValue('durationMinutes', total ? String(total) : '');
    }
    setDurationError('');
    setDurationMode(nextMode);
  };

  const save = (values: FormValues) => {
    const durationMinutes =
      durationMode === 'minutes'
        ? Number(values.durationMinutes)
        : (Number(values.durationHours) || 0) * 60 +
          (Number(values.durationRemainder) || 0);
    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 1440
    ) {
      setDurationError('Enter a duration from 1 minute to 24 hours.');
      return;
    }

    const focusAreas = values.focusAreas
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (focusAreas.length > 20 || focusAreas.some((item) => item.length > 120)) {
      setFocusError('Use up to 20 focus areas, each 120 characters or fewer.');
      return;
    }
    setDurationError('');
    setFocusError('');

    const data: PracticeSessionManualInput = {
      practiceDate: values.practiceDate,
      elapsedSeconds: durationMinutes * 60,
      pieceId: values.pieceId ? Number(values.pieceId) : null,
      category: values.category,
      goal: values.goal.trim(),
      notes: values.notes.trim(),
      focusAreas,
    };
    const onSuccess = () => onSaved();
    if (session) {
      update.mutate({ id: session.id, data }, { onSuccess });
    } else {
      create.mutate({ data }, { onSuccess });
    }
  };

  const busy = create.isPending || update.isPending;
  const mutationError = create.error || update.error;
  const dateRegistration = form.register('practiceDate', {
    required: 'Choose a practice date.',
  });
  const durationMinutesRegistration = form.register('durationMinutes');
  const durationHoursRegistration = form.register('durationHours');
  const durationRemainderRegistration = form.register('durationRemainder');
  const focusAreasRegistration = form.register('focusAreas');

  return (
    <Modal
      title={session ? 'Edit practice record' : 'Log practice'}
      onClose={onClose}
      wide
    >
      <p className="modal-intro">
        Record the practice you did, whether or not you used the timer.
      </p>
      <Form {...form}>
        <form className="manual-log-form" onSubmit={form.handleSubmit(save)}>
          <div className="manual-form-grid">
            <Field label="Practice date">
              <input
                type="date"
                max={todayKey}
                {...dateRegistration}
                aria-invalid={Boolean(form.formState.errors.practiceDate)}
                data-testid="input-manual-practice-date"
              />
            </Field>
            <Field label="Piece">
              <select
                {...form.register('pieceId')}
                data-testid="select-manual-practice-piece"
              >
                <option value="">Open practice</option>
                {repertoire.map((piece) => (
                  <option value={piece.id} key={piece.id}>
                    {piece.title} — {piece.composer}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="manual-duration-heading">
            <strong>Practice duration</strong>
            <div className="duration-mode" aria-label="Duration input format">
              <button
                type="button"
                className={durationMode === 'minutes' ? 'is-active' : ''}
                aria-pressed={durationMode === 'minutes'}
                onClick={() => changeDurationMode('minutes')}
                data-testid="button-duration-minutes-mode"
              >
                Minutes
              </button>
              <button
                type="button"
                className={durationMode === 'hours-minutes' ? 'is-active' : ''}
                aria-pressed={durationMode === 'hours-minutes'}
                onClick={() => changeDurationMode('hours-minutes')}
                data-testid="button-duration-hours-mode"
              >
                Hours + minutes
              </button>
            </div>
          </div>
          {durationMode === 'minutes' ? (
            <Field label="Total minutes">
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                inputMode="numeric"
                {...durationMinutesRegistration}
                onChange={(event) => {
                  durationMinutesRegistration.onChange(event);
                  setDurationError('');
                }}
                aria-describedby={durationError ? 'manual-duration-error' : undefined}
                data-testid="input-manual-duration-minutes"
              />
            </Field>
          ) : (
            <div className="manual-form-grid manual-duration-fields">
              <Field label="Hours">
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  inputMode="numeric"
                  {...durationHoursRegistration}
                  onChange={(event) => {
                    durationHoursRegistration.onChange(event);
                    setDurationError('');
                  }}
                  data-testid="input-manual-duration-hours"
                />
              </Field>
              <Field label="Minutes">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  inputMode="numeric"
                  {...durationRemainderRegistration}
                  onChange={(event) => {
                    durationRemainderRegistration.onChange(event);
                    setDurationError('');
                  }}
                  aria-describedby={durationError ? 'manual-duration-error' : undefined}
                  data-testid="input-manual-duration-remainder"
                />
              </Field>
            </div>
          )}
          {durationError && (
            <p id="manual-duration-error" className="form-inline-error" role="alert">
              {durationError}
            </p>
          )}

          <div className="manual-form-grid">
            <Field label="Practice category">
              <select
                {...form.register('category')}
                data-testid="select-manual-practice-category"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {titleCase(category)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Exercise or specific focus">
              <input
                maxLength={2000}
                placeholder="e.g. shifting, a passage, or an exercise"
                {...form.register('goal')}
                data-testid="input-manual-practice-focus"
              />
            </Field>
          </div>
          <Field label="Focus areas">
            <input
              maxLength={2400}
              placeholder="Separate areas with commas, e.g. bow hold, intonation"
              {...focusAreasRegistration}
              onChange={(event) => {
                focusAreasRegistration.onChange(event);
                setFocusError('');
              }}
              aria-describedby={focusError ? 'manual-focus-error' : undefined}
              data-testid="input-manual-focus-areas"
            />
          </Field>
          {focusError && (
            <p id="manual-focus-error" className="form-inline-error" role="alert">
              {focusError}
            </p>
          )}
          <Field label="Notes">
            <textarea
              rows={3}
              maxLength={5000}
              placeholder="Anything you want to remember from this session"
              {...form.register('notes')}
              data-testid="textarea-manual-practice-notes"
            />
          </Field>
          {mutationError && (
            <p className="form-inline-error" role="alert">
              Practice could not be saved. Check your connection and try again.
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton
              type="submit"
              busy={busy}
              data-testid="button-save-manual-practice"
            >
              {session ? 'Save changes' : 'Save practice'}
            </SubmitButton>
          </div>
        </form>
      </Form>
    </Modal>
  );
}

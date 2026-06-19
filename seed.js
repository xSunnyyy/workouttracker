// Seed exercise library
const SEED_EXERCISES = [
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    emoji: '🏋️',
    description: 'A compound pressing movement that builds the chest, front delts and triceps.',
    startImage: null,
    endImage: null,
    instructions:
      '1. Lie on a flat bench, eyes under the bar.\n2. Grip slightly wider than shoulder width.\n3. Unrack and lower the bar to mid-chest with control.\n4. Press back up to lockout, keeping shoulder blades retracted.',
    keywords: ['bench', 'press', 'chest', 'flat'],
  },
  {
    id: 'squat',
    name: 'Squat',
    muscleGroup: 'Legs',
    equipment: 'Barbell',
    emoji: '🦵',
    description: 'The king of lower-body lifts — quads, glutes and core all in one.',
    instructions:
      '1. Position the bar on your upper back.\n2. Brace your core, feet shoulder-width.\n3. Descend by pushing hips back and bending knees.\n4. Drive through mid-foot to stand.',
    keywords: ['squat', 'legs', 'quads', 'glutes'],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'Back',
    equipment: 'Barbell',
    emoji: '💪',
    description: 'A full-body pull that builds the posterior chain like nothing else.',
    instructions:
      '1. Stand with mid-foot under the bar.\n2. Hinge down, grip the bar just outside knees.\n3. Set the back flat, chest up.\n4. Drive the floor away and stand tall, lockout hips.',
    keywords: ['deadlift', 'pull', 'back', 'hamstrings'],
  },
  {
    id: 'shoulder-press',
    name: 'Shoulder Press',
    muscleGroup: 'Shoulders',
    equipment: 'Barbell',
    emoji: '🏋️‍♂️',
    description: 'Vertical pressing for capped delts and a strong overhead position.',
    instructions:
      '1. Bar at the front rack, elbows under the bar.\n2. Brace and press overhead.\n3. Lockout with biceps near ears.\n4. Lower with control to the collarbone.',
    keywords: ['ohp', 'overhead', 'press', 'shoulders'],
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    equipment: 'Machine',
    emoji: '🧗',
    description: 'A vertical pulling movement targeting the lats and upper back.',
    instructions:
      '1. Grip the bar slightly wider than shoulders.\n2. Pull the bar to your upper chest.\n3. Squeeze the lats at the bottom.\n4. Slowly return to a full stretch.',
    keywords: ['lat', 'pulldown', 'back'],
  },
  {
    id: 'seated-row',
    name: 'Seated Row',
    muscleGroup: 'Back',
    equipment: 'Cable',
    emoji: '🚣',
    description: 'Horizontal pulling for mid-back thickness and rear delts.',
    instructions:
      '1. Sit tall with feet planted.\n2. Pull the handle to your stomach.\n3. Squeeze shoulder blades together.\n4. Return slowly under control.',
    keywords: ['row', 'seated', 'back', 'cable'],
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    muscleGroup: 'Arms',
    equipment: 'Dumbbell',
    emoji: '💪',
    description: 'A staple bicep builder — supinated curl with strict form.',
    instructions:
      '1. Stand tall, dumbbells at sides.\n2. Curl up, keeping elbows pinned.\n3. Supinate the wrist at the top.\n4. Lower slowly to full extension.',
    keywords: ['curl', 'biceps', 'dumbbell', 'arms'],
  },
  {
    id: 'triceps-pushdown',
    name: 'Triceps Pushdown',
    muscleGroup: 'Arms',
    equipment: 'Cable',
    emoji: '🦾',
    description: 'Isolation work for the triceps with constant cable tension.',
    instructions:
      '1. Grip the bar or rope.\n2. Keep elbows pinned to your sides.\n3. Press down to full lockout.\n4. Return only until the elbows reach 90°.',
    keywords: ['triceps', 'pushdown', 'cable', 'arms'],
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    emoji: '🦿',
    description: 'A loaded knee-dominant movement, great for hypertrophy.',
    instructions:
      '1. Feet shoulder-width on the platform.\n2. Lower until knees reach ~90°.\n3. Drive through mid-foot and heels.\n4. Avoid locking out hard at the top.',
    keywords: ['leg press', 'legs', 'machine'],
  },
  {
    id: 'leg-curl',
    name: 'Leg Curl',
    muscleGroup: 'Legs',
    equipment: 'Machine',
    emoji: '🦵',
    description: 'Hamstring isolation to balance out quad-heavy training.',
    instructions:
      '1. Position pad just above the heels.\n2. Curl with control, squeeze at the top.\n3. Lower slowly to a stretch.\n4. Avoid bouncing weights.',
    keywords: ['leg curl', 'hamstrings'],
  },
  {
    id: 'chest-press-machine',
    name: 'Chest Press Machine',
    muscleGroup: 'Chest',
    equipment: 'Machine',
    emoji: '🏋️',
    description: 'A safe and effective chest builder, easy to push to failure.',
    instructions:
      '1. Adjust seat so handles align with mid-chest.\n2. Press out to near lockout.\n3. Return until you feel a deep stretch.\n4. Keep the shoulders down and back.',
    keywords: ['chest press', 'machine', 'chest'],
  },
  {
    id: 'cable-row',
    name: 'Cable Row',
    muscleGroup: 'Back',
    equipment: 'Cable',
    emoji: '🚣',
    description: 'A versatile rowing variation — change handles to hit different angles.',
    instructions:
      '1. Sit tall, slight forward lean from the hips.\n2. Pull handle toward your navel.\n3. Drive elbows back, squeeze.\n4. Reset with a full stretch each rep.',
    keywords: ['cable row', 'back', 'row'],
  },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

const SEED_PROGRAMS = [
  {
    id: 'starter-program',
    name: 'Push Pull Legs',
    notes: 'Classic 3-day split. Repeat twice a week for higher frequency.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    routines: [
      {
        id: 'push-day',
        name: 'Push Day',
        notes: 'Chest, shoulders, triceps',
        exercises: ['bench-press', 'shoulder-press', 'chest-press-machine', 'triceps-pushdown'],
      },
      {
        id: 'pull-day',
        name: 'Pull Day',
        notes: 'Back and biceps',
        exercises: ['deadlift', 'lat-pulldown', 'seated-row', 'dumbbell-curl'],
      },
      {
        id: 'leg-day',
        name: 'Leg Day',
        notes: 'Quads, hamstrings, glutes',
        exercises: ['squat', 'leg-press', 'leg-curl'],
      },
    ],
  },
];

export const ROLES = {
  ADMIN:         'admin',
  TEACHER:       'teacher',
  PARENT:        'parent',
  FEE_COLLECTOR: 'fee_collector',
};

export const ROLE_LABELS = {
  admin:         'Admin',
  teacher:       'Teacher',
  parent:        'Parent',
  fee_collector: 'Fee Collector',
};

export const CLASSES = [
  'Nursery',
  'Lower KG',
  'Upper KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
];

export const SECTIONS = ['A', 'B', 'C', 'D'];

export const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi',
  'Social Studies', 'Computer', 'Physical Education', 'Art',
];

export const FEE_STRUCTURE = {
  'Nursery':  1200,
  'Lower KG': 1400,
  'Upper KG': 1400,
  'Class 1':  1500,
  'Class 2':  1500,
  'Class 3':  1800,
  'Class 4':  1800,
  'Class 5':  1800,
  'Class 6':  2000,
  'Class 7':  2200,
  'Class 8':  2500,
};

export const EXAM_TYPES = [
  { value: 'unit_test',   label: 'Unit Test' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual',      label: 'Annual Exam' },
  { value: 'assessment',  label: 'Assessment' },
];
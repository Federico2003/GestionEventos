import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido').trim(),
  password: z.string().min(4, 'La contraseña es requerida')
});

export const createClientSchema = z.object({
  organizerId: z.string().min(1).optional(),
  firstName: z.string().min(1, 'El nombre es obligatorio').max(80),
  lastName: z.string().min(1, 'El apellido es obligatorio').max(80),
  email: z.string().email('Correo del cliente inválido'),
  phone: z.string().min(7, 'Teléfono inválido').max(25),
  notes: z.string().max(500).optional().default('')
});

export const createEventSchema = z.object({
  clientId: z.string().min(1, 'El cliente titular es obligatorio'),
  title: z.string().min(3, 'El título del evento debe tener al menos 3 caracteres').max(140),
  eventType: z
    .enum(['wedding', 'fifteen_years', 'corporate', 'graduation', 'social'])
    .default('wedding'),
  eventDate: z.string().min(8, 'Fecha del evento requerida'),
  venueName: z.string().min(2, 'La sede es obligatoria').max(140),
  venueAddress: z.string().max(250).optional().default(''),
  initialBudget: z.number().nonnegative('El presupuesto no puede ser negativo'),
  estimatedGuests: z.number().int().nonnegative().default(100)
});

export const updateClientSchema = createClientSchema
  .omit({ organizerId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo a actualizar'
  });

export const updateEventSchema = createEventSchema
  .omit({ clientId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo a actualizar'
  });

export const cancelEventSchema = z.object({
  reason: z.string().min(3, 'Debe indicar el motivo de la cancelación').max(300)
});

export const cloneEventSchema = z.object({
  title: z.string().min(3, 'Título requerido para el evento clonado').max(140),
  eventDate: z.string().min(8, 'Nueva fecha requerida')
});

export const createTableSchema = z.object({
  tableNumber: z.number().int().positive('Número de mesa inválido'),
  label: z.string().max(80).optional(),
  capacity: z.number().int().min(1).max(30).default(10)
});

export const createGuestSchema = z.object({
  firstName: z.string().min(1, 'Nombre obligatorio').max(80),
  lastName: z.string().max(80).optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  phone: z.string().max(25).optional().default(''),
  rsvpStatus: z.enum(['pending', 'confirmed', 'declined']).default('pending'),
  plusOnes: z.number().int().min(0).max(5).default(0),
  tableNumber: z.number().int().positive().nullable().optional().default(null),
  mealPreference: z
    .enum(['standard', 'vegetarian', 'vegan', 'child', 'kosher', 'other'])
    .default('standard'),
  allergies: z.string().max(200).optional().default(''),
  hasCriticalAllergies: z.boolean().optional().default(false),
  dietaryRestrictions: z.string().max(250).optional().default('')
});

export const updateRsvpSchema = z.object({
  rsvpStatus: z.enum(['pending', 'confirmed', 'declined']),
  plusOnes: z.number().int().min(0).max(5).default(0),
  mealPreference: z
    .enum(['standard', 'vegetarian', 'vegan', 'child', 'kosher', 'other'])
    .optional(),
  allergies: z.string().max(200).optional(),
  hasCriticalAllergies: z.boolean().optional(),
  dietaryRestrictions: z.string().max(250).optional()
});

export const assignTableSchema = z.object({
  tableNumber: z.number().int().positive('Número de mesa requerido')
});

export const createExpenseSchema = z.object({
  concept: z.string().min(2, 'El concepto es obligatorio').max(150),
  category: z.enum([
    'catering',
    'photography',
    'music_dj',
    'venue',
    'decoration',
    'flowers',
    'security',
    'transport',
    'contingency',
    'other'
  ]),
  amount: z.number().positive('El monto debe ser mayor a cero'),
  dueDate: z.string().optional().nullable().default(null),
  paymentStatus: z.enum(['pending', 'partial', 'paid']).default('pending'),
  eventServiceId: z.string().optional().nullable().default(null)
});

export const registerPaymentSchema = z.object({
  receiptFileName: z.string().min(3).max(160),
  contentBase64: z.string().optional().default('JVBERi0xLjQK')
});

export const createVendorSchema = z.object({
  businessName: z.string().min(2, 'Razón social obligatoria').max(120),
  category: z.enum([
    'catering',
    'photography',
    'music_dj',
    'venue',
    'decoration',
    'flowers',
    'security',
    'transport',
    'other'
  ]),
  contactName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(7).max(25),
  rating: z.number().min(1).max(5).default(5)
});

export const createContractSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().min(2).max(120),
  vendorName: z.string().min(2).max(120),
  category: z
    .enum([
      'catering',
      'photography',
      'music_dj',
      'venue',
      'decoration',
      'flowers',
      'security',
      'transport',
      'other'
    ])
    .default('catering'),
  agreedPrice: z.number().positive(),
  notes: z.string().max(300).optional().default(''),
  autoGenerateExpense: z.boolean().optional().default(true)
});

export const attachContractDocSchema = z.object({
  fileName: z.string().min(3).max(160),
  contentBase64: z.string().optional().default('JVBERi0xLjQK')
});

export const createTaskSchema = z.object({
  title: z.string().min(2, 'El título de la tarea es obligatorio').max(150),
  description: z.string().max(400).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().min(8, 'Fecha límite requerida'),
  assignedTo: z.string().optional().nullable().default(null)
});

export const createAgendaItemSchema = z.object({
  title: z.string().min(2, 'El título del bloque es obligatorio').max(140),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM inválido'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM inválido'),
  responsiblePerson: z.string().min(2).max(100).default('Coordinador General'),
  locationDetail: z.string().max(120).optional().default(''),
  notes: z.string().max(300).optional().default('')
});

export const reorderAgendaSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1)
});

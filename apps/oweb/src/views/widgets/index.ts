import type { FieldElement } from '../../lib/odoo-types'
import {
  BooleanToggleWidget,
  BooleanWidget,
  CharWidget,
  DatetimeWidget,
  DateWidget,
  FloatWidget,
  HtmlWidget,
  IntegerWidget,
  MonetaryWidget,
  TextWidget,
} from './basic'
import { BinaryWidget, ImageFieldWidget } from './media'
import {
  AttachmentImageWidget,
  Many2ManyWidget,
  Many2OneAvatarWidget,
  Many2OneWidget,
  One2ManyWidget,
} from './relational'
import { PriorityWidget, SelectionWidget, StateBadgeWidget } from './selection'
import {
  ColorPickerWidget,
  EmailWidget,
  HandleWidget,
  Many2ManyTagsWidget,
  PhoneWidget,
  ProgressbarWidget,
  UrlWidget,
} from './utility'

export interface FieldWidgetProps {
  field: FieldElement
  value: unknown
  onChange: (value: unknown) => void
  readOnly?: boolean
  meta?: { selection?: [string, string][]; type?: string; relation?: string; domain?: unknown }
  record?: Record<string, unknown>
  model?: string
  recordId?: number
}

// Odoo 19 style: edit mode = bottom border only, read-only = plain text
export const FIELD_INPUT_CLASS =
  'w-full border-0 border-b border-border-default bg-transparent px-1 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none'

// Re-export all widget components for direct use
export {
  AttachmentImageWidget,
  BinaryWidget,
  BooleanToggleWidget,
  BooleanWidget,
  CharWidget,
  ColorPickerWidget,
  DatetimeWidget,
  DateWidget,
  EmailWidget,
  FloatWidget,
  HandleWidget,
  HtmlWidget,
  ImageFieldWidget,
  IntegerWidget,
  Many2ManyTagsWidget,
  Many2ManyWidget,
  Many2OneAvatarWidget,
  Many2OneWidget,
  MonetaryWidget,
  One2ManyWidget,
  PhoneWidget,
  PriorityWidget,
  ProgressbarWidget,
  SelectionWidget,
  StateBadgeWidget,
  TextWidget,
  UrlWidget,
}

// ── Widget Registry ─────────────────────────────────────────────────

export const TYPE_WIDGETS: Record<string, React.ComponentType<FieldWidgetProps>> = {
  char: CharWidget,
  text: TextWidget,
  integer: IntegerWidget,
  float: FloatWidget,
  monetary: MonetaryWidget,
  boolean: BooleanWidget,
  date: DateWidget,
  datetime: DatetimeWidget,
  selection: SelectionWidget,
  priority: PriorityWidget,
  state: StateBadgeWidget,
  many2one: Many2OneWidget,
  many2many: Many2ManyWidget,
  one2many: One2ManyWidget,
  binary: BinaryWidget,
  image: BinaryWidget,
  html: HtmlWidget,
  reference: Many2OneWidget,
}

const WIDGET_OVERRIDES: Record<string, React.ComponentType<FieldWidgetProps>> = {
  priority: PriorityWidget,
  state: StateBadgeWidget,
  statusbar: StateBadgeWidget,
  boolean_toggle: BooleanToggleWidget,
  many2one_avatar: Many2OneAvatarWidget,
  email: EmailWidget,
  phone: PhoneWidget,
  url: UrlWidget,
  many2many_tags: Many2ManyTagsWidget,
  many2many: Many2ManyTagsWidget,
  handle: HandleWidget,
  color_picker: ColorPickerWidget,
  progressbar: ProgressbarWidget,
  attachment_image: AttachmentImageWidget,
}

export function getFieldWidget(
  field: FieldElement,
  type: string,
): React.ComponentType<FieldWidgetProps> {
  // widget attribute from XML arch overrides type-based selection
  if (field.widget && WIDGET_OVERRIDES[field.widget]) {
    return WIDGET_OVERRIDES[field.widget]
  }
  if (field.widget && TYPE_WIDGETS[field.widget]) {
    return TYPE_WIDGETS[field.widget]
  }
  return TYPE_WIDGETS[type] ?? CharWidget
}

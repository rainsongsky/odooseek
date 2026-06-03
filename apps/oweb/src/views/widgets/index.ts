import type { FieldElement } from '@odooseek/odoo-client'
import { BackgroundImageWidget } from './BackgroundImage'
import { BadgeWidget } from './BadgeWidget'
import { BadgeSelectionFilterWidget } from './badge-selection-filter'
import {
  BooleanToggleWidget,
  BooleanWidget,
  CharWidget,
  DatetimeWidget,
  DateWidget,
  FloatTimeWidget,
  FloatWidget,
  HtmlWidget,
  IntegerWidget,
  MonetaryWidget,
  PercentageWidget,
  TextWidget,
} from './basic'
import { CodeEditorWidget } from './code-editor'
import { DaterangeWidget } from './daterange'
import { DomainWidget } from './domain'
import { FieldSelectorWidget } from './field-selector'
import { FilterableSelectionWidget } from './filterable-selection'
import { FloatFactorWidget } from './float-factor'
import { GaugeWidget, StatInfoWidget } from './gauge-statinfo'
import { JsonCheckboxesWidget, JsonWidget } from './json-widgets'
import { Many2ManyAvatarUserWidget } from './many2many-avatar'
import { Many2ManyBinaryWidget } from './many2many-binary'
import { BinaryWidget, ImageFieldWidget } from './media'
import {
  ActivityExceptionWidget,
  Many2ManyTaxTagsWidget,
  UpgradeBooleanWidget,
} from './misc-widgets'
import { OrgChartWidget } from './OrgChart'
import { PresenceIcon } from './PresenceIcon'
import { DynamicSelectionWidget, ProjectTaskStateWidget } from './phaseB-widgets'
import { PropertiesWidget } from './properties'
import {
  AttachmentImageWidget,
  Many2ManyCheckboxesWidget,
  Many2ManyTagsAvatarWidget,
  Many2ManyWidget,
  Many2OneAvatarWidget,
  Many2OneWidget,
  One2ManyWidget,
} from './relational'
import {
  BadgeSelectionWidget,
  LabelSelectionWidget,
  PriorityWidget,
  RadioWidget,
  SelectionWidget,
  StateBadgeWidget,
  StateSelectionWidget,
  StatusbarWidget,
} from './selection'
import { SignatureWidget } from './signature'
import { Many2OneUomWidget, TimesheetUomWidget } from './uom-widgets'
import {
  BooleanFavoriteWidget,
  BooleanIconWidget,
  ColorPickerWidget,
  CopyClipboardWidget,
  EmailWidget,
  HandleWidget,
  ImageUrlWidget,
  KanbanActivityWidget,
  Many2ManyTagsWidget,
  PercentPieWidget,
  PhoneWidget,
  ProgressbarWidget,
  RemainingDaysWidget,
  RottingWidget,
  UrlWidget,
  WebRibbonWidget,
} from './utility'
import { VersionTimeline } from './VersionTimeline'

/** Stable no-op callback — avoids creating new function references on every render. */
export const NOOP = () => {}

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
  ActivityExceptionWidget,
  AttachmentImageWidget,
  BadgeSelectionFilterWidget,
  BadgeSelectionWidget,
  BadgeWidget,
  BinaryWidget,
  BooleanFavoriteWidget,
  BooleanIconWidget,
  BooleanToggleWidget,
  BooleanWidget,
  CharWidget,
  CodeEditorWidget,
  ColorPickerWidget,
  CopyClipboardWidget,
  DaterangeWidget,
  DatetimeWidget,
  DateWidget,
  DomainWidget,
  DynamicSelectionWidget,
  EmailWidget,
  FieldSelectorWidget,
  FilterableSelectionWidget,
  FloatFactorWidget,
  FloatTimeWidget,
  FloatWidget,
  GaugeWidget,
  HandleWidget,
  HtmlWidget,
  ImageFieldWidget,
  ImageUrlWidget,
  IntegerWidget,
  JsonCheckboxesWidget,
  JsonWidget,
  KanbanActivityWidget,
  LabelSelectionWidget,
  Many2ManyAvatarUserWidget,
  Many2ManyBinaryWidget,
  Many2ManyCheckboxesWidget,
  Many2ManyTagsAvatarWidget,
  Many2ManyTagsWidget,
  Many2ManyTaxTagsWidget,
  Many2ManyWidget,
  Many2OneAvatarWidget,
  Many2OneUomWidget,
  Many2OneWidget,
  MonetaryWidget,
  One2ManyWidget,
  OrgChartWidget,
  PercentageWidget,
  PercentPieWidget,
  PhoneWidget,
  PresenceIcon,
  PriorityWidget,
  ProgressbarWidget,
  ProjectTaskStateWidget,
  PropertiesWidget,
  RadioWidget,
  RemainingDaysWidget,
  RottingWidget,
  SelectionWidget,
  SignatureWidget,
  StateBadgeWidget,
  StateSelectionWidget,
  StatInfoWidget,
  StatusbarWidget,
  TextWidget,
  TimesheetUomWidget,
  UpgradeBooleanWidget,
  UrlWidget,
  VersionTimeline,
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
  statusbar: StatusbarWidget,
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
  // Phase 24
  radio: RadioWidget,
  many2many_checkboxes: Many2ManyCheckboxesWidget,
  many2many_tags_avatar: Many2ManyTagsAvatarWidget,
  // Phase 25
  float_time: FloatTimeWidget,
  percentage: PercentageWidget,
  selection_badge: BadgeSelectionWidget,
  BadgeWidget,
  label_selection: LabelSelectionWidget,
  state_selection: StateSelectionWidget,
  // Phase 26
  boolean_favorite: BooleanFavoriteWidget,
  boolean_icon: BooleanIconWidget,
  copy_clipboard: CopyClipboardWidget,
  remaining_days: RemainingDaysWidget,
  image_url: ImageUrlWidget,
  percentpie: PercentPieWidget,
  contact_image: ImageFieldWidget,
  web_ribbon: WebRibbonWidget,
  kanban_activity: KanbanActivityWidget,
  rotting: RottingWidget,
  signature: SignatureWidget,
  daterange: DaterangeWidget,
  properties: PropertiesWidget,
  lead_properties: PropertiesWidget,
  task_properties: PropertiesWidget,
  // HR
  background_image: BackgroundImageWidget,
  presence_icon: PresenceIcon,
  org_chart: OrgChartWidget,
  version_timeline: VersionTimeline,
  badge_print: BadgeWidget,
  // New widgets (issue #243-#245)
  filterable_selection: FilterableSelectionWidget,
  float_factor: FloatFactorWidget,
  gauge: GaugeWidget,
  statinfo: StatInfoWidget,
  selection_badge_with_filter: BadgeSelectionFilterWidget,
  domain: DomainWidget,
  ace: CodeEditorWidget,
  code: CodeEditorWidget,
  many2many_binary: Many2ManyBinaryWidget,
  many2many_avatar_user: Many2ManyAvatarUserWidget,
  many2many_tax_tags: Many2ManyTaxTagsWidget,
  timesheet_uom: TimesheetUomWidget,
  many2one_uom: Many2OneUomWidget,
  upgrade_boolean: UpgradeBooleanWidget,
  activity_exception: ActivityExceptionWidget,
  dynamic_selection: DynamicSelectionWidget,
  project_task_state_selection: ProjectTaskStateWidget,
  field_selector: FieldSelectorWidget,
  json: JsonWidget,
  json_checkboxes: JsonCheckboxesWidget,
  account_json_checkboxes: JsonCheckboxesWidget,
}

const WIDGET_ALIASES: Record<string, keyof typeof WIDGET_OVERRIDES> = {
  hr_presence_status: 'presence_icon',
  hr_icon_display: 'presence_icon',
  hr_org_chart: 'org_chart',
  hr_department_chart: 'org_chart',
  hr_version_timeline: 'version_timeline',
  versions_timeline: 'version_timeline',
  employee_badge: 'badge_print',
  hr_employee_badge: 'badge_print',
  // HR field widgets from employee form
  many2many_tags_salary_bank: 'many2many_tags',
  work_permit_upload: 'binary',
  many2many_avatar_employee_field: 'many2many',
  image_1920: 'contact_image',
  employee_properties: 'properties',
  kanban_employee_avatar: 'many2one_avatar',
  // Odoo 19 high-frequency aliases
  many2one_avatar_user: 'many2one_avatar',
  many2one_avatar_employee: 'many2one_avatar',
  many2one_avatar_resource: 'many2one_avatar',
  res_partner_many2one: 'many2one',
  many2one_barcode: 'many2one',
  many2many_tags_avatar_popover: 'many2many_tags_avatar',
  CopyClipboardChar: 'copy_clipboard',
  CopyClipboardURL: 'copy_clipboard',
  CopyClipboardButton: 'copy_clipboard',
  list_activity: 'kanban_activity',
  badge: 'selection_badge',
  badge_selection: 'selection_badge',
  formatte_date: 'date',
  boolean_radio: 'radio',
  float_toggle: 'boolean_toggle',
  image_radio: 'radio',
  boolean_toggle_confirm: 'boolean_toggle',
  checkbox: 'boolean',
  color: 'color_picker',
  kanban_color_picker: 'color_picker',
  rotting_statusbar_duration: 'statusbar',
  section_and_note_text: 'text',
  // CRM
  many2one_avatar_leader_user: 'many2one_avatar',
  badge_rotting: 'selection_badge',
}

function resolveWidgetOverride(widget?: string) {
  if (!widget) return undefined
  if (WIDGET_OVERRIDES[widget]) return WIDGET_OVERRIDES[widget]
  const alias = WIDGET_ALIASES[widget]
  if (alias) return WIDGET_OVERRIDES[alias]
  return undefined
}

export function getFieldWidget(
  field: FieldElement,
  type: string,
): React.ComponentType<FieldWidgetProps> {
  const override = resolveWidgetOverride(field.widget)
  if (override) return override
  if (field.widget && TYPE_WIDGETS[field.widget]) {
    return TYPE_WIDGETS[field.widget]
  }
  return TYPE_WIDGETS[type] ?? CharWidget
}

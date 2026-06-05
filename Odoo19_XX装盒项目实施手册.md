# Odoo 19 XX装盒项目实施手册

> 版本: v1.0  
> 适用 Odoo 版本: 19.0 Community / Enterprise  
> 基于文档: 《XX装盒项目需求文档》  

---

## 目录

1. [实施总览](#1-实施总览)
2. [模块清单与安装](#2-模块清单与安装)
3. [基础数据配置](#3-基础数据配置)
4. [用户角色与权限](#4-用户角色与权限)
5. [第一阶段: CRM 销售线索管理](#5-第一阶段-crm-销售线索管理)
6. [第二阶段: 方案设计与工程资料](#6-第二阶段-方案设计与工程资料)
7. [第三阶段: 销售跟踪与商机转化](#7-第三阶段-销售跟踪与商机转化)
8. [第四阶段: 任务单与项目管理](#8-第四阶段-任务单与项目管理)
9. [第五阶段: BOM 与三维设计管理](#9-第五阶段-bom-与三维设计管理)
10. [第六阶段: 采购与外协管理](#10-第六阶段-采购与外协管理)
11. [第七阶段: 车间组装与电工接电](#11-第七阶段-车间组装与电工接电)
12. [第八阶段: 调试与质量管理](#12-第八阶段-调试与质量管理)
13. [第九阶段: 发货与物流管理](#13-第九阶段-发货与物流管理)
14. [第十阶段: 售后服务管理](#14-第十阶段-售后服务管理)
15. [自动化与报表](#15-自动化与报表)
16. [实施路线图](#16-实施路线图)

---

## 1. 实施总览

### 1.1 业务模块对应关系

```
需求阶段                Odoo 模块                     核心模型
────────────────────────────────────────────────────────────
销售线索                crm                           crm.lead
方案设计                base (附件) + mrp_plm         ir.attachment
销售跟踪                crm + sale                    crm.lead
商机/订单               sale + sale_management        sale.order
任务单流转              project                       project.task
三维设计/BOM            mrp                           mrp.bom / mrp.bom.line
采购与外协              purchase                      purchase.order
车间组装/电工           mrp + quality_control         mrp.workorder
调试                    project + quality_control     project.task / quality.check
发货                    stock + delivery              stock.picking
售后服务                helpdesk (或 project)         helpdesk.ticket / project.task
```

### 1.2 系统架构建议

```
┌─────────────────────────────────────────────────┐
│                  Odoo 19 核心                     │
├──────────┬──────────┬──────────┬────────────────┤
│   CRM    │  Sale    │ Project  │   Helpdesk     │
│ 线索/商机│ 报价/订单│ 任务/项目│  售后工单      │
├──────────┼──────────┼──────────┼────────────────┤
│   MRP    │ Purchase │  Stock   │   Quality      │
│ BOM/生产 │ 采购/外协│ 库存/发货│  检验/警报     │
├──────────┴──────────┴──────────┴────────────────┤
│              基础模块(base/mail/contacts)        │
└─────────────────────────────────────────────────┘
```

---

## 2. 模块清单与安装

### 2.1 必装模块 (Community)

| 模块名 | 技术名称 | 用途 |
|--------|---------|------|
| CRM | `crm` | 销售线索、商机管道管理 |
| Sales | `sale` | 销售报价、订单管理 |
| Sales Management | `sale_management` | 销售高级功能 |
| CRM-Sale 桥接 | `sale_crm` | 商机转报价 |
| Project | `project` | 项目管理、任务单 |
| MRP | `mrp` | 制造BOM、工单 |
| Purchase | `purchase` | 采购、外协 |
| Inventory | `stock` | 库存、发货 |
| Contacts | `contacts` | 客户/供应商管理 |

### 2.2 推荐安装模块

| 模块名 | 技术名称 | 用途 |
|--------|---------|------|
| PLM | `mrp_plm` | 工程变更管理、BOM 版本控制 |
| Quality | `quality_control` | 质量检验点、检验警报 |
| Quality Worksheet | `quality_control_worksheet` | 工序检验作业指导书 |
| Delivery | `delivery` | 运输商管理、运费计算 |
| Project MRP 桥接 | `project_mrp` | 项目关联生产 |
| Purchase MRP 桥接 | `purchase_mrp` | 采购关联生产 |
| Sale MRP 桥接 | `sale_mrp` | 销售关联生产 |

### 2.3 Enterprise 可选模块

| 模块名 | 技术名称 | 用途 |
|--------|---------|------|
| Helpdesk | `helpdesk` | 售后工单、SLA |
| Field Service | `industry_fsm` | 现场服务 |
| Documents | `documents` | 文档管理、OCR |
| Sign | `sign` | 电子签章、审批 |

### 2.4 安装命令

```bash
# 通过 Odoo 命令行安装 (Community 最小集)
odoo-bin -d <数据库名> -i crm,sale,sale_management,sale_crm,project,mrp,purchase,stock,contacts

# 完整推荐集
odoo-bin -d <数据库名> -i crm,sale,sale_management,sale_crm,project,mrp,purchase,stock,contacts,\
mrp_plm,quality_control,quality_control_worksheet,delivery,project_mrp,purchase_mrp,sale_mrp
```

---

## 3. 基础数据配置

### 3.1 公司信息

**路径**: 设置 → 公司 → 更新信息

```
公司名称: XX装盒有限公司
地址: [公司地址]
电话: [公司电话]
邮箱: [公司邮箱]
税号: [统一社会信用代码]
```

### 3.2 用户与员工

**路径**: 设置 → 用户 → 新建 / 员工 → 新建

按需求文档中的角色创建用户:

| 用户名 | 员工关联 | 角色 |
|--------|---------|------|
| sales01 | 张三 | 销售 |
| sales02 | 李四 | 销售 |
| engineer01 | 王五 | 工程/方案设计 |
| pm01 | 赵六 | 项目管理/任务协调 |
| designer01 | 钱七 | 三维设计 |
| purchaser01 | 孙八 | 采购/外协 |
| assembler01 | 周九 | 车间组装 |
| electrician01 | 吴十 | 电工 |
| tester01 | 郑十一 | 调试人员 |
| warehouse01 | 陈十二 | 仓储/物流 |
| support01 | 褚十三 | 售后 |

### 3.3 产品类别

**路径**: 库存 → 配置 → 产品类别

```
├── 成品
│   └── 装盒设备
├── 原材料
│   ├── 机械件
│   ├── 电气件
│   └── 外协件
├── 备品备件
└── 服务
    ├── 设计服务
    ├── 装配服务
    └── 调试服务
```

### 3.4 仓库配置

**路径**: 库存 → 配置 → 仓库

```
主仓库: XX装盒工厂仓库
├── 原材料库位
├── 在制品库位
├── 成品库位
├── 备品备件库位
└── 外协库位
```

---

## 4. 用户角色与权限

### 4.1 权限组定义

**路径**: 设置 → 用户 → 群组

#### 4.1.1 销售组 (Sales Group)

```
继承: 用户类型 → 内部用户
包含权限:
  - CRM: 用户 (自己的线索)
  - Sales: 用户 (自己的文档)
  - Contacts: 用户
```

#### 4.1.2 销售经理 (Sales Manager)

```
继承: 销售组
包含权限:
  - CRM: 管理员
  - Sales: 管理员
  - 查看所有线索和订单
```

#### 4.1.3 工程设计组 (Engineering Group)

```
继承: 内部用户
包含权限:
  - MRP: 用户
  - PLM: 用户
  - 文档: 管理员
  - Inventory: 用户 (只读)
```

#### 4.1.4 项目管理组 (Project Manager)

```
继承: 内部用户
包含权限:
  - Project: 管理员
  - MRP: 用户 (只读)
  - Purchase: 用户 (只读)
  - Inventory: 用户 (只读)
```

#### 4.1.5 三维设计组 (Design Group)

```
继承: 内部用户
包含权限:
  - MRP: 管理员 (BOM 管理)
  - PLM: 管理员
  - Inventory: 用户 (只读)
```

#### 4.1.6 采购组 (Purchasing Group)

```
继承: 内部用户
包含权限:
  - Purchase: 管理员
  - Inventory: 用户
```

#### 4.1.7 车间生产组 (Manufacturing Group)

```
继承: 内部用户
包含权限:
  - MRP: 用户
  - Quality: 用户
  - Inventory: 用户
```

#### 4.1.8 仓储物流组 (Warehouse Group)

```
继承: 内部用户
包含权限:
  - Inventory: 管理员
  - Delivery: 用户
```

#### 4.1.9 售后组 (Support Group)

```
继承: 内部用户
包含权限:
  - Helpdesk: 用户 (如有)
  - Project: 用户
  - Contacts: 用户
```

### 4.2 菜单权限配置

**路径**: 设置 → 技术 → 菜单项

针对各角色需要**隐藏的菜单**:
- 销售组不需要看到 MRP、Purchase、Inventory 菜单（通过群组菜单可见性控制）
- 生产组不需要看到 CRM、Sales 完整菜单

### 4.3 记录规则 (Record Rules)

**路径**: 设置 → 技术 → 安全 → 记录规则

```xml
<!-- 销售只能看自己的线索 -->
<record id="crm_lead_personal_rule" model="ir.rule">
    <field name="name">销售个人线索</field>
    <field name="model_id" ref="crm.model_crm_lead"/>
    <field name="domain_force">[('user_id','=',user.id)]</field>
    <field name="groups" eval="[(4, ref('sales_team.group_sale_salesman'))]"/>
</record>
```

---

## 5. 第一阶段: CRM 销售线索管理

> 对应需求: §7.1 销售线索阶段

### 5.1 线索阶段配置

**路径**: CRM → 配置 → 阶段

```yaml
阶段配置:
  - 新线索:
      sequence: 1
      fold: false
  - 需求调研中:
      sequence: 2
      fold: false
  - A级线索:
      sequence: 3
      fold: false
      requirements: true
  - B级线索:
      sequence: 4
      fold: true
  - C级线索:
      sequence: 5
      fold: true
  - 方案制作中:
      sequence: 6
      fold: false
  - 报价已发送:
      sequence: 7
      fold: false
  - 赢单:
      sequence: 10
      fold: false
      won: true
  - 输单:
      sequence: 11
      fold: true
      lost: true
```

### 5.2 线索自定义字段

**路径**: CRM → 配置 → 字段 → 新建

| 字段名 | 技术名 | 类型 | 说明 |
|--------|--------|------|------|
| 线索级别 | `x_lead_level` | Selection | A/B/C 三级 |
| 客户痛点 | `x_customer_pain` | Text | 客户核心痛点描述 |
| 需求范围 | `x_requirement_scope` | Text | 装盒规格、产能等 |
| 预算范围 | `x_budget_range` | Monetary | 客户预算 |
| 期望交期 | `x_expected_delivery` | Date | |
| 合规筛查结果 | `x_compliance_check` | Selection | 通过/不通过/待确认 |
| 调研状态 | `x_survey_status` | Selection | 未开始/进行中/已完成 |
| 竞品信息 | `x_competitor_info` | Text | 竞品名称、方案、报价 |
| 需求调研表 | `x_survey_doc` | Many2one → ir.attachment | 关联调研文档 |

### 5.3 线索视图定制

**路径**: CRM → 配置 → 视图

#### 5.3.1 线索看板视图增强

在看板卡片上展示线索级别、客户名称、预算、期望交期:

```xml
<record id="crm_lead_kanban_custom" model="ir.ui.view">
    <field name="name">crm.lead.kanban.xx</field>
    <field name="model">crm.lead</field>
    <field name="inherit_id" ref="crm.crm_case_kanban_view_leads"/>
    <field name="arch" type="xml">
        <xpath expr="//div[hasclass('o_kanban_record_body')]" position="inside">
            <field name="x_lead_level" widget="badge"
                   decoration-success="x_lead_level=='a'"
                   decoration-warning="x_lead_level=='b'"
                   decoration-muted="x_lead_level=='c'"/>
            <field name="x_budget_range" widget="monetary"/>
            <field name="x_expected_delivery"/>
        </xpath>
    </field>
</record>
```

### 5.4 线索分级自动化

**路径**: 设置 → 技术 → 自动化规则

创建自动化规则，根据预算和需求明确度自动分级:

```
规则名称: 自动线索分级
模型: crm.lead
触发条件: 创建和更新时
过滤条件: (预算范围 > 500000 且 调研状态 = '已完成')
动作: 设置 线索级别 = 'A'
```

### 5.5 输出物管理

| 需求输出物 | Odoo 实现方式 |
|-----------|-------------|
| 客户需求调研表 | 线索表单中 `x_requirement_scope` 字段 + 附件 `x_survey_doc` |
| 线索分级结果 | 看板上 `x_lead_level` Badge 可视化 |
| 初步需求说明 | Chatter 中记录或关联文档附件 |

---

## 6. 第二阶段: 方案设计与工程资料

> 对应需求: §7.2 工程师方案图阶段

### 6.1 方案设计工作流

```
销售提交需求 → 创建工程任务 → 制作方案图 → 内部评审 → 客户确认 → 版本归档
```

### 6.2 工程方案任务模板

**路径**: Project → 配置 → 项目 → 新建项目"工程方案设计"

创建任务阶段:

```yaml
阶段:
  - 待分配:
      sequence: 1
  - 方案制作中:
      sequence: 2
  - 内部评审:
      sequence: 3
  - 客户确认中:
      sequence: 4
  - 已确认:
      sequence: 5
      fold: true
  - 需修改:
      sequence: 6
```

### 6.3 工程资料版本管理

**方案 A: 使用附件 + 约定命名** (Community)

```
文件命名规范:
{项目编号}_{文档类型}_V{版本号}.{扩展名}
示例: P2024-001_工程方案图_V1.0.pdf
```

在任务中添加附件字段并启用版本记录 (通过 Chatter 日志)。

**方案 B: 使用 MRP PLM 模块** (推荐)

**路径**: PLM → 工程变更

创建 ECO (Engineering Change Order):

```
ECO 编号: ECO-2024-001
关联产品: [装盒设备]
变更类型: 新增 / 修改
变更描述: 根据客户需求调整方案
影响范围: BOM / 图纸 / 采购清单
审批流: 工程设计 → 项目经理 → 客户确认
附件: 工程方案图 V2.0
```

### 6.4 方案版本记录字段

在工程任务上添加自定义字段:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 方案版本号 | `x_design_version` | Char |
| 修改原因 | `x_revision_reason` | Text |
| 上版本参考 | `x_previous_version` | Many2one → ir.attachment |
| 技术澄清清单 | `x_tech_clarifications` | Text |

---

## 7. 第三阶段: 销售跟踪与商机转化

> 对应需求: §7.3 销售跟踪阶段 + §7.4 商机阶段

### 7.1 销售活动类型

**路径**: CRM → 配置 → 活动类型

```
活动类型:
  - 电话沟通:    默认时长 30分钟
  - 客户拜访:    默认时长 2小时
  - 方案演示:    默认时长 1小时
  - 邮件跟进:    默认时长 15分钟
  - 报价发送:    默认时长 30分钟
  - 竞品分析:    默认时长 1小时
  - 商务谈判:    默认时长 1小时
```

### 7.2 竞品信息字段

在 `crm.lead` 表单上增加:

| 字段名 | 技术名 | 类型 | 说明 |
|--------|--------|------|------|
| 竞品名称 | `x_competitor_name` | Char | |
| 竞品方案 | `x_competitor_solution` | Text | |
| 竞品报价 | `x_competitor_price` | Monetary | |
| 竞品优势 | `x_competitor_strength` | Text | |
| 我方优势 | `x_our_strength` | Text | |
| 竞品汇总文件 | `x_competitor_file` | Many2one → ir.attachment | |

### 7.3 商机阶段配置

**路径**: CRM → 配置 → 销售团队 → 阶段

```yaml
商机阶段:
  - 意向确认:      sequence: 1  fold: false
  - 订单评审中:    sequence: 2  fold: false
  - 合同谈判:      sequence: 3  fold: false
  - 已签约:        sequence: 4  fold: false
  - 赢单:          sequence: 5  fold: true  won: true
```

### 7.4 订单评审字段

在 `sale.order` 上添加:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 付款方式 | `x_payment_method` | Selection: 预付/分期/验收后付 |
| 交付周期(天) | `x_delivery_days` | Integer |
| 质量要求 | `x_quality_requirements` | Text |
| 售后条款 | `x_warranty_terms` | Text |
| 评审意见 | `x_review_comments` | Text |
| 评审状态 | `x_review_status` | Selection: 待评审/通过/需修改 |
| 评审人 | `x_reviewed_by` | Many2one → res.users |
| 评审日期 | `x_review_date` | Date |

### 7.5 商机转任务单自动化

**路径**: 设置 → 技术 → 自动化规则

```
规则名称: 赢单后自动创建项目任务
模型: crm.lead
触发条件: stage_id 变为"赢单"阶段
动作: 
  1. 创建 sale.order (从商机生成报价)
  2. 创建 project.project (新项目)
  3. 创建 project.task (任务单) → 分配给项目经理
```

---

## 8. 第四阶段: 任务单与项目管理

> 对应需求: §7.5 任务单流转阶段

### 8.1 项目模板

**路径**: Project → 配置 → 项目模板

创建标准装盒项目模板，包含预设任务:

```yaml
项目模板名称: 装盒项目标准模板
预设任务:
  1. 三维设计阶段:
      - 三维建模          | 预计 5天 | 三维设计
      - BOM 输出          | 预计 1天 | 三维设计
      - 采购清单整理      | 预计 1天 | 三维设计
      - 图纸标准化        | 预计 1天 | 三维设计
  2. 采购阶段:
      - 标准件采购        | 预计 7天 | 采购
      - 外协件采购        | 预计 10天 | 采购
      - 电气件采购        | 预计 5天 | 采购
  3. 生产阶段:
      - 车间装配          | 预计 5天 | 车间
      - 电工接电          | 预计 3天 | 电工
      - 出厂调试          | 预计 3天 | 调试
  4. 发货阶段:
      - 装箱发货          | 预计 1天 | 仓储
  5. 售后阶段:
      - 现场安装调试      | 预计 3天 | 售后
      - 客户培训          | 预计 1天 | 售后
      - 验收签收          | 预计 1天 | 售后
```

### 8.2 任务单字段扩展

在 `project.task` 上添加:

| 字段名 | 技术名 | 类型 | 说明 |
|--------|--------|------|------|
| 节点类型 | `x_node_type` | Selection | 设计/采购/生产/调试/发货/售后 |
| 计划开始 | (使用原生 `date_assign` 或 `planned_date_begin`) |
| 计划完成 | (使用原生 `date_deadline`) |
| 实际开始 | `x_actual_start` | DateTime |
| 实际完成 | `x_actual_end` | DateTime |
| 责任人 | (使用原生 `user_id`) |
| 延期原因 | `x_delay_reason` | Text |
| 异常标记 | `x_is_abnormal` | Boolean |
| 异常描述 | `x_abnormal_desc` | Text |
| 交接状态 | `x_handover_status` | Selection |
| 前序任务 | `x_blocked_by` | Many2many → project.task |
| 后续任务 | `x_blocking` | Many2many → project.task |

### 8.3 进度监控视图

**甘特图**: Project → 任务 → 甘特图视图 (原生支持)

**进度看板**: 
```xml
<record id="project_task_kanban_custom" model="ir.ui.view">
    <field name="name">project.task.kanban.xx</field>
    <field name="model">project.task</field>
    <field name="inherit_id" ref="project.view_task_kanban"/>
    <field name="arch" type="xml">
        <xpath expr="//div[hasclass('oe_kanban_details')]" position="inside">
            <field name="x_node_type"/>
            <field name="x_is_abnormal" widget="boolean_toggle"/>
            <t t-if="record.x_delay_reason.raw_value">
                <span class="text-danger">延期: <field name="x_delay_reason"/></span>
            </t>
        </xpath>
    </field>
</record>
```

### 8.4 异常与延期预警

```
规则名称: 任务延期预警
模型: project.task
触发条件: 基于时间的触发 (每天检查)
过滤条件: date_deadline < today 且 stage 不是 Done/Cancel
动作: 
  1. 设置 x_is_abnormal = True
  2. 给任务负责人发送通知
  3. 给项目经理发送通知
```

### 8.5 项目里程碑

**路径**: Project → 项目 → 里程碑

```yaml
里程碑:
  - 方案确认完成
  - 三维设计完成
  - BOM 发布
  - 采购下单完成
  - 物料齐套
  - 装配完成
  - 电气接线完成
  - 出厂调试完成
  - 发货完成
  - 验收签收
```

---

## 9. 第五阶段: BOM 与三维设计管理

> 对应需求: §7.6 三维制作阶段

### 9.1 产品定义

**路径**: MRP → 产品 → 产品

```yaml
产品示例:
  - 名称: XX-1000 全自动装盒机
  - 产品类型: 可库存产品
  - 产品类别: 成品/装盒设备
  - 路线: 制造
  - 单位: 台
  - 销售价格: [按报价单]
```

### 9.2 BOM 结构示例

**路径**: MRP → 产品 → 物料清单

```
BOM: XX-1000 全自动装盒机
├─ 机械组件 (类型: Phantom BOM)
│  ├─ 机架焊接件           Qty: 1
│  ├─ 传动机构             Qty: 1
│  │  ├─ 伺服电机          Qty: 2
│  │  ├─ 减速器            Qty: 2
│  │  ├─ 同步带            Qty: 4
│  │  └─ 轴承座            Qty: 8
│  ├─ 装盒工位组件         Qty: 1
│  └─ 外观钣金件           Qty: 1
├─ 电气组件 (类型: Phantom BOM)
│  ├─ PLC 控制器           Qty: 1
│  ├─ 触摸屏(HMI)          Qty: 1
│  ├─ 传感器套件           Qty: 1
│  ├─ 电缆线束             Qty: 1
│  └─ 电气柜总成           Qty: 1
├─ 气动组件
│  ├─ 气缸                 Qty: 6
│  └─ 电磁阀组             Qty: 2
└─ 外协件
   ├─ 定制加工件A          Qty: 2
   └─ 定制加工件B          Qty: 4
```

### 9.3 BOM 自定义字段

| 字段名 | 技术名 | 类型 | 说明 |
|--------|--------|------|------|
| 图纸编号 | `x_drawing_number` | Char | |
| 图纸版本 | `x_drawing_version` | Char | (PLM 中由 ECO 自动管理) |
| 三维模型文件 | `x_3d_model` | Many2one → ir.attachment | |
| 二维图纸文件 | `x_2d_drawing` | Many2one → ir.attachment | |
| 材质 | `x_material` | Char | |
| 表面处理 | `x_surface_treatment` | Char | |

### 9.4 采购清单自动生成

在 BOM 确认后，通过自动化规则从 BOM 生成采购清单:

```
规则名称: BOM确认后生成采购需求
触发: BOM 状态变为"已确认"
动作:
  - 遍历 BOM Line
  - 对于 type='product' 且 route_ids 包含'Buy' 的物料
  - 生成 purchase.order 草稿或以采购申请方式通知采购部门
```

### 9.5 工程变更管理 (PLM)

**路径**: PLM → 工程变更

```yaml
ECO 流程:
  1. 设计师提交 ECO → 变更原因/影响范围/新图纸
  2. 工程主管审核
  3. 项目经理批准
  4. 如有采购影响: 通知采购部门
  5. 如有生产影响: 通知车间
  6. 应用变更 → BOM 自动更新版本号
  7. 附件归档 → 变更历史可追溯
```

---

## 10. 第六阶段: 采购与外协管理

> 对应需求: §7.7 采购与外协阶段

### 10.1 供应商管理

**路径**: Contacts → 供应商

供应商分级字段:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 供应商等级 | `x_supplier_grade` | Selection: A/B/C |
| 供应类别 | `x_supply_category` | Selection: 机械/电气/气动/外协加工/标准件 |
| 质量评分 | `x_quality_score` | Float (1-100) |
| 交期准确率 | `x_delivery_accuracy` | Float (%) |
| 合作开始 | `x_cooperation_start` | Date |
| 备选供应商 | `x_alternative_supplier` | Many2one → res.partner |

供应商台账通过 "供应商" 主数据 + Purchases 模块的采购历史自动累计。

### 10.2 采购询价流程

```yaml
流程:
  1. 生成 RFQ (询价单):
     - 路径: Purchase → 新建 → 询价单
     - 物料从 BOM 导入
  2. 发送询价:
     - 选择供应商 → 发送邮件 (含 PDF)
  3. 供应商报价:
     - 录入报价价格和交期
  4. 比价:
     - 通过报价对比视图选择最优供应商
  5. 确认 RFQ → 转为采购订单
```

### 10.3 采购订单自定义字段

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 关联项目 | `x_project_id` | Many2one → project.project |
| 需求交期 | `x_required_date` | Date |
| 关键物料标记 | `x_is_critical` | Boolean |
| 外协进度 | `x_subcon_progress` | Float (%) |
| 异常预案 | `x_contingency_plan` | Text |
| 质量控制要求 | `x_qc_requirements` | Text |

### 10.4 交期追踪看板

创建采购订单看板，按交期状态分组:

```
看板列:
  - 待确认:    RFQ 状态
  - 已下单:    PO 已确认, 未到货
  - 部分到货:  有收货记录
  - 已完成:    全部收货
  - 异常/延期:  标记异常的 PO
```

### 10.5 到期预警

```
规则名称: 采购交期预警
模型: purchase.order
触发: 基于时间 (每天)
条件: date_planned < today 且 state 不是 done/cancel
动作: 发送通知给采购员
```

---

## 11. 第七阶段: 车间组装与电工接电

> 对应需求: §7.8 车间组装阶段 + §7.9 电工接电阶段

### 11.1 工作中心配置

**路径**: MRP → 配置 → 工作中心

```yaml
工作中心:
  - 机加工中心:
      代码: WS001
      工作时间: 周一-周六 8:00-17:00
      效率: 100%
      产能: 1台/天
  - 装配中心:
      代码: WS002
      工作时间: 周一-周六 8:00-17:00
      效率: 100%
      产能: 2台/天
  - 电气接线中心:
      代码: WS003
      工作时间: 周一-周六 8:00-17:00
      效率: 100%
      产能: 1台/天
  - 调试中心:
      代码: WS004
      工作时间: 周一-周六 8:00-17:00
      效率: 100%
      产能: 1台/天
```

### 11.2 工艺路线配置

**路径**: MRP → 配置 → 工艺路线

```yaml
工艺路线: 装盒机标准路线
工序:
  1. 机架装配:
      工作中心: 装配中心
      时长: 120分钟
      作业指导书: [SOP-001 机架装配作业指导书]
  2. 传动系统装配:
      工作中心: 装配中心
      时长: 180分钟
      作业指导书: [SOP-002 传动系统装配]
  3. 电气接线:
      工作中心: 电气接线中心
      时长: 240分钟
      作业指导书: [SOP-003 电气接线标准]
  4. 整机调试:
      工作中心: 调试中心
      时长: 180分钟
      作业指导书: [SOP-004 调试标准]
```

### 11.3 制造订单 (MO)

**路径**: MRP → 操作 → 制造订单

制造订单从销售订单自动生成 (MTO / Make to Order):

```
规则: 销售订单确认 → 自动创建制造订单 → 关联工艺路线 → 拆分为工单
```

### 11.4 SOP 作业指导书管理

在每个工单 (`mrp.workorder`) 的操作页面 Tab 中, 上传 PDF 作业指导书:

**自定义字段**:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| SOP 文档 | `x_sop_document` | Many2one → ir.attachment |
| 关键工序点 | `x_key_operation_points` | Text |
| 检验要求 | `x_inspection_requirements` | Text |

### 11.5 装配过程记录

通过 Quality 模块的检验工单记录:

**路径**: Quality → 质量控制 → 质量控制点

```yaml
检验点配置:
  - 名称: 机架装配检验
    关联工序: 机架装配
    类型: 工序中检验
    检验项:
      - 装配尺寸检查
      - 螺栓扭矩检查
      - 外观检查
  - 名称: 传动系统检验
    关联工序: 传动系统装配
    类型: 工序中检验
    检验项:
      - 传动间隙检查
      - 皮带张力检查
      - 轴承运转检查
```

### 11.6 电工接电专项配置

在电气接线工作中心下的工单中:

| 字段名 | 技术名 | 类型 | 说明 |
|--------|--------|------|------|
| IO 表附件 | `x_io_table` | Many2one → ir.attachment | |
| 电路图附件 | `x_circuit_diagram` | Many2one → ir.attachment | |
| 元件核对清单 | `x_component_checklist` | Text | |
| 接线完成状态 | `x_wiring_status` | Selection | 未开始/进行中/已完成 |
| 操作说明书 | `x_operation_manual` | Many2one → ir.attachment | |

---

## 12. 第八阶段: 调试与质量管理

> 对应需求: §7.10 调试阶段

### 12.1 调试任务管理

在项目模板中创建调试子任务:

```
项目 → XX装盒项目 → 调试阶段
├─ 调试计划编制
├─ 机械调试
├─ 电气调试
├─ 联动调试
├─ 问题整改
└─ 客户预验收
```

### 12.2 调试自定义字段

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 调试预计时长 | `x_debug_estimated_hours` | Float |
| 调试实际时长 | `x_debug_actual_hours` | Float |
| 临时零件需求 | `x_temp_parts_needed` | Text |
| 调试问题清单 | `x_debug_issues` | One2many → 自定义问题模型 |
| 调试视频 | `x_debug_video` | Many2many → ir.attachment |
| 预验收结果 | `x_pre_acceptance_result` | Selection: 通过/需整改/不通过 |
| 预验收报告 | `x_pre_acceptance_report` | Many2one → ir.attachment |

### 12.3 问题闭环管理

**方案 A: 使用 Quality Alert** (推荐)

**路径**: Quality → 质量控制 → 质量警报

```yaml
质量警报流程:
  1. 创建警报 → 描述问题 / 严重程度 / 关联工单
  2. 分配责任人
  3. 责任人分析根因 → 填写处理方案
  4. 实施纠正措施
  5. 验证 → 关闭警报
```

**方案 B: 创建自定义"问题追踪"模型**

如需更灵活的管理，可自建模型 `x_debug.issue`:

```
x_debug.issue 字段:
  - 问题标题 (Char)
  - 问题描述 (Text)
  - 严重程度 (Selection: 高/中/低)
  - 责任人 (Many2one → res.users)
  - 状态 (Selection: 待处理/处理中/已解决/已验证)
  - 处理方案 (Text)
  - 关联任务 (Many2one → project.task)
  - 临时零件需求 (Text)
  - 处理期限 (Date)
  - 关闭日期 (Date)
```

### 12.4 影像资料管理

调试过程将影像资料以附件形式关联到项目任务:

```python
# 在项目任务 Chatter 中上传
# 或通过 Odoo Documents 模块集中管理
文件类型: 视频 (.mp4), 照片 (.jpg), 报告 (.pdf)
命名规范: {项目编号}_调试_{日期}_{序号}.{扩展名}
```

---

## 13. 第九阶段: 发货与物流管理

> 对应需求: §7.11 发货阶段

### 13.1 发货流程配置

**路径**: 库存 → 配置 → 操作类型

```yaml
操作类型:
  发货:
    名称: 装盒设备发货
    默认源库位: 成品库位
    默认目标库位: 客户
    序列: WH/OUT
```

### 13.2 装箱清单

通过库存调拨单 (`stock.picking`) 的详细操作页面管理:

**自定义字段**:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 箱号 | `x_box_number` | Char |
| 装箱照片 | `x_packing_photos` | Many2many → ir.attachment |
| 备品备件清单 | `x_spare_parts_list` | Text |
| 装箱检查人 | `x_packing_checker` | Many2one → res.users |
| 装箱检查日期 | `x_packing_check_date` | Date |
| 运输商 | (原生的 `carrier_id` 字段) |
| 物流单号 | `x_tracking_number` | Char |
| 出货影像 | `x_shipment_photos` | Many2many → ir.attachment |

### 13.3 发货检查清单

在发货单上添加检查步骤 (通过 Quality Check):

```
发货检查项:
  ✓ 装箱外观检查
  ✓ 关键部件防锈处理
  ✓ 备品备件清点
  ✓ 随机文件齐全 (说明书/合格证/保修卡)
  ✓ 箱唛信息正确
  ✓ 拍照留档
```

### 13.4 运输跟踪

**Delivery 模块配置**:

**路径**: 库存 → 配置 → 运输方式

```
运输方式:
  - 名称: 德邦物流
  - 承运商: 德邦
  - 产品页显示: 是
  - 固定价格 / 按重量计算
```

---

## 14. 第十阶段: 售后服务管理

> 对应需求: §7.12 售后服务阶段

### 14.1 售后方案选择

```
方案 A: 使用 Helpdesk 模块 (Enterprise)
优点: 原生 SLA、工单管理、客户门户
缺点: Enterprise 许可费用

方案 B: 基于 Project 模块自建 (Community)
优点: 零额外成本、灵活定制
缺点: 无原生 SLA, 需自行配置
```

### 14.2 方案 B: 基于 Project 的售后实现

#### 14.2.1 售后项目模板

```yaml
售后项目模板:
  名称: 售后服务项目
  阶段:
    - 待分配
    - 现场调试中
    - 问题处理中
    - 待客户验收
    - 已完成
    - 关闭
```

#### 14.2.2 售后自定义字段

在 `project.task` 上添加:

| 字段名 | 技术名 | 类型 |
|--------|--------|------|
| 任务类型 | `x_task_type` | Selection (添加"售后"选项) |
| 服务地点 | `x_service_location` | Char |
| 现场状况 | `x_site_conditions` | Text |
| 服务时长(天) | `x_service_days` | Float |
| 售后服务报告 | `x_service_report` | Many2one → ir.attachment |
| 回访状态 | `x_followup_status` | Selection: 待回访/已回访 |
| 回访日期 | `x_followup_date` | Date |
| 客户满意度 | `x_customer_satisfaction` | Selection: 满意/一般/不满意 |
| 客户反馈 | `x_customer_feedback` | Text |
| 改进建议 | `x_improvement_suggestions` | Text |
| 现场照片 | `x_site_photos` | Many2many → ir.attachment |

#### 14.2.3 售后回访提醒

```
规则名称: 售后回访提醒
模型: project.task (x_task_type = '售后')
触发: 任务完成后的第30天
条件: x_followup_status = '待回访'
动作: 创建回访活动, 分配给售后人员
```

### 14.3 方案 A: Helpdesk 配置 (Enterprise)

**路径**: Helpdesk → 配置 → 帮助台团队

```yaml
帮助台团队: 售后服务
  - 名称: XX装盒售后服务
  - 时区: Asia/Shanghai
  - 工作时间: 周一-周五 9:00-18:00
  - SLA 策略:
      - 紧急问题: 4小时响应
      - 普通问题: 24小时响应
      - 咨询类: 48小时响应
```

---

## 15. 自动化与报表

### 15.1 关键自动化规则汇总

| # | 规则名称 | 触发条件 | 动作 |
|---|---------|---------|------|
| 1 | 线索自动分级 | crm.lead 更新 | 按预算/需求评分定级 |
| 2 | 商机转任务 | 商机赢单 | 创建项目+任务+销售订单 |
| 3 | 任务延期预警 | 每日检查 | 标记异常+通知 |
| 4 | BOM 确认→采购需求 | BOM 状态变更 | 生成采购建议 |
| 5 | 采购交期预警 | 每日检查 | 通知采购员 |
| 6 | 工单完成通知 | 工单完成 | 通知调试人员 |
| 7 | 发货完成通知 | 发货确认 | 通知售后+客户 |
| 8 | 售后回访提醒 | 售后完成后30天 | 创建回访活动 |
| 9 | 异常升级 | 异常超过N天未关闭 | 通知项目经理+部门主管 |

### 15.2 仪表板与报表

#### 15.2.1 销售仪表板 (CRM → 仪表板)

```
显示内容:
  - 本月新线索数量
  - 线索转化率
  - 商机金额 Pipeline
  - 各销售业绩排名
  - 预计签单金额
```

#### 15.2.2 项目仪表板 (Project → 仪表板)

```
显示内容:
  - 活跃项目数
  - 延期任务数
  - 任务完成率
  - 异常任务统计
```

#### 15.2.3 生产仪表板 (MRP → 仪表板)

```
显示内容:
  - 进行中的制造订单
  - 工单完成率
  - 设备效率
  - 质量问题统计
```

#### 15.2.4 自定义报表 (使用 Pivot 和 Graph 视图)

```
建议报表:
  - 项目交付准时率: project.task (按 project, x_actual_end vs date_deadline)
  - 采购料件准时率: purchase.order.line (按 supplier, date_planned)
  - 质量问题分类统计: quality.alert (按问题分类/严重程度)
  - 项目成本分析: sale.order + purchase.order + timesheet 汇总
```

### 15.3 数据导出

各视图支持:
- 一键导出 Excel: 视图 → 收藏夹 → 导出
- 定时邮件报表: 设置 → 技术 → 定时动作 → 生成报表并邮件发送

---

## 16. 实施路线图

### 16.1 分阶段实施建议

```
阶段一 (第1-2周): 基础架构
├── Odoo 19 安装部署
├── 模块安装 (CRM, Sale, Project 最小集)
├── 公司数据配置
├── 用户/角色/权限配置
└── 基础数据导入 (客户/供应商)

阶段二 (第2-4周): 销售流程
├── CRM 线索阶段和字段定制
├── 销售报价模板
├── 商机转任务自动化
└── 培训销售团队

阶段三 (第4-6周): 项目管理
├── 项目模板配置
├── 任务阶段和字段定制
├── 甘特图/看板配置
├── 延期预警规则
└── 培训项目团队

阶段四 (第6-8周): 生产管理
├── 产品/BOM 数据导入
├── 工作中心和工艺路线配置
├── 制造订单流程
├── 质量检验点配置
└── 培训设计/生产团队

阶段五 (第8-10周): 采购与库存
├── 采购流程配置
├── 供应商数据导入
├── 库存库位配置
├── 发货流程配置
├── 交期预警规则
└── 培训采购/仓储团队

阶段六 (第10-12周): 售后与报表
├── 售后流程配置 (Helpdesk 或 Project 方案)
├── 问题闭环管理
├── 仪表板/报表定制
├── 全流程端到端测试
└── 全员培训
```

### 16.2 培训计划

| 培训对象 | 内容 | 时长 |
|---------|------|------|
| 管理层 | 仪表板、报表、流程审批 | 2小时 |
| 销售团队 | CRM 线索管理、报价、商机转化 | 4小时 |
| 工程设计 | 附件管理、PLM、任务操作 | 3小时 |
| 项目经理 | 项目模板、任务分配、甘特图、预警 | 4小时 |
| 三维设计 | BOM 创建、ECO 变更、图纸挂载 | 3小时 |
| 采购团队 | 供应商管理、询价、采购订单、交期追踪 | 3小时 |
| 车间团队 | 工单操作、SOP 查看、检验记录 | 2小时 |
| 仓储团队 | 收货、发货、装箱、运输跟踪 | 2小时 |
| 售后团队 | 售后任务管理、回访记录、客户反馈 | 2小时 |

### 16.3 验收标准

| 验收项 | 标准 |
|--------|------|
| 全流程跑通 | 从线索录入→订单→任务→生产→发货→售后全流程闭环 |
| 数据准确性 | BOM、采购订单、库存数量与实际一致 |
| 响应时效 | 系统操作响应 < 3秒 |
| 用户覆盖 | 所有10类角色均能正常使用 |
| 异常处理 | 延期预警、超期通知正常工作 |

---

## 附录 A: 关键模块模型关系图

```
crm.lead ──(convert)──> sale.order
                              │
                              ├──> mrp.production ──> mrp.workorder
                              │         │
                              │         └──> quality.check
                              │
                              ├──> purchase.order
                              │
                              └──> project.task
                                        │
                                        └──> helpdesk.ticket (售后)
```

## 附录 B: 自定义字段汇总

| 模型 | 字段(技术名) | 用途 |
|------|-------------|------|
| crm.lead | x_lead_level, x_customer_pain, x_budget_range, x_competitor_* | 线索管理 |
| sale.order | x_payment_method, x_delivery_days, x_review_status | 订单评审 |
| project.task | x_node_type, x_actual_start/end, x_delay_reason, x_is_abnormal | 任务管理 |
| mrp.bom | x_drawing_number, x_drawing_version, x_3d_model | BOM/图纸 |
| purchase.order | x_project_id, x_is_critical, x_contingency_plan | 采购管理 |
| mrp.workorder | x_sop_document, x_io_table, x_circuit_diagram | 装配/电气 |
| stock.picking | x_box_number, x_packing_photos, x_spare_parts_list | 发货管理 |

## 附录 C: 推荐第三方模块

| 模块 | 用途 | 来源 |
|------|------|------|
| OCA/web_responsive | 增强移动端体验 | OCA |
| OCA/project_timeline | 项目时间线视图 | OCA |
| OCA/web_m2x_options | 增强 Many2 字段功能 | OCA |
| OCA/server_action_domain | 自动化增强 | OCA |
| Odoo Studio | 可视化自定义字段/视图/报表 | Odoo Enterprise |

---

> **文档结束**  
> 实施过程中遇到的问题可参照本文档各章节的配置路径进行调整。建议在正式环境实施前，先在测试环境完成全流程验证。

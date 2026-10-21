"""Generate documentation diagrams (not screenshots) as PNG + editable SVG.
Run with Pillow installed: python tools/generate-doc-diagrams.py
Optional font overrides: DOCS_FONT and DOCS_FONT_BOLD.
"""
from pathlib import Path
import math
import os
import html
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "images"
W, H = 1440, 1000
C = dict(bg="#F5F7FB", paper="#FFFFFF", ink="#17233B", muted="#5F6D83",
         line="#D8DFEB", blue="#3459CA", pale="#EAF0FF", green="#18764C",
         gpale="#E6F5ED", red="#AD333C", rpale="#FBECEF", amber="#91600E", apale="#FFF3D8")
FONT = os.environ.get("DOCS_FONT", "C:/Windows/Fonts/msyh.ttc")
BOLD = os.environ.get("DOCS_FONT_BOLD", "C:/Windows/Fonts/msyhbd.ttc")
if not Path(FONT).is_file() or not Path(BOLD).is_file():
    raise SystemExit("Set DOCS_FONT and DOCS_FONT_BOLD to installed Chinese font files.")

class Diagram:
    def __init__(self, title, subtitle, number):
        self.im = Image.new("RGB", (W, H), C["bg"])
        self.draw = ImageDraw.Draw(self.im)
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">',
                      f'<title id="title">{html.escape(title)}</title>',
                      f'<desc id="desc">{html.escape(subtitle)}。操作流程示意图，非真实界面截图。</desc>',
                      f'<rect width="{W}" height="{H}" fill="{C["bg"]}"/>']
        self.text(64, 36, "TeamManeger / 使用指南", 21, C["blue"], True)
        self.text(64, 80, title, 43, C["ink"], True)
        self.text(64, 146, subtitle, 25, C["muted"])
        self.line([(64, 914), (1376, 914)], C["line"], 2)
        self.text(64, 936, "操作流程示意图 · 基于 v0.2.2 · 非运行界面截图", 21, C["muted"])
        self.text(1270, 936, f"0{number} / 04", 21, C["blue"], True)

    def rect(self, x, y, w, h, fill="paper", stroke="line", radius=18, width=2):
        fill = C.get(fill, fill)
        stroke = C.get(stroke, stroke) if stroke else None
        self.draw.rounded_rectangle((x, y, x+w, y+h), radius, fill=fill, outline=stroke, width=width)
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{width}"/>')

    def text(self, x, y, value, size=26, color=None, bold=False):
        color = color or C["ink"]
        f = ImageFont.truetype(BOLD if bold else FONT, size)
        assert x + self.draw.textlength(value, font=f) <= W-30, (value, "text exceeds canvas")
        self.draw.text((x, y), value, font=f, fill=color, anchor="lt")
        self.parts.append(f'<text x="{x}" y="{y}" fill="{color}" font-family="Microsoft YaHei,Noto Sans SC,sans-serif" font-size="{size}" font-weight="{600 if bold else 400}" dominant-baseline="text-before-edge">{html.escape(value)}</text>')

    def paragraph(self, x, y, value, maxwidth, size=25, color=None, bold=False, leading=1.55):
        f = ImageFont.truetype(BOLD if bold else FONT, size)
        lines = []
        for raw in value.split("\n"):
            line = ""
            for char in raw:
                if line and self.draw.textlength(line+char, font=f) > maxwidth:
                    lines.append(line)
                    line = char
                else:
                    line += char
            lines.append(line)
        for i, line in enumerate(lines):
            self.text(x, y + i*int(size*leading), line, size, color, bold)
        return y + len(lines)*int(size*leading)

    def line(self, pts, color=None, width=3, arrow=False):
        color = color or C["blue"]
        self.draw.line(pts, fill=color, width=width, joint="curve")
        self.parts.append(f'<polyline points="{" ".join(f"{x},{y}" for x,y in pts)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"/>')
        if arrow:
            x,y = pts[-1]
            px,py = pts[-2]
            a = math.atan2(y-py, x-px)
            points = [(x,y), (x-14*math.cos(a-0.45),y-14*math.sin(a-0.45)), (x-14*math.cos(a+0.45),y-14*math.sin(a+0.45))]
            self.draw.polygon(points, fill=color)
            self.parts.append(f'<polygon points="{" ".join(f"{u:.1f},{v:.1f}" for u,v in points)}" fill="{color}"/>')

    def box(self, x,y,w,h,title,body="",tone="blue",pill=None):
        self.rect(x,y,w,h)
        self.rect(x+1,y+22,5,h-44,fill=tone,stroke=None,radius=2)
        self.text(x+25,y+22,title,29,C[tone],True)
        if body:
            end = self.paragraph(x+25,y+73,body,w-50,24,C["muted"])
            assert end <= y+h-12, (title, "body exceeds box",end,y+h)
        if pill:
            self.text(x+w-130,y+28,pill,20,C["muted"])

    def save(self, stem):
        OUT.mkdir(parents=True, exist_ok=True)
        self.im.save(OUT/f"{stem}.png", optimize=True)
        (OUT/f"{stem}.svg").write_text("\n".join(self.parts+["</svg>"])+"\n", encoding="utf-8")
        print(f"{stem}: {W}x{H} PNG + SVG")


def entry():
    d = Diagram("从哪里开始？", "一个安装包，两个组件开关；管理词条与打开回收站各有入口。", 1)
    d.rect(385,214,670,84,"blue",None)
    d.text(428,237,"安装 dsh-team-manager 安装包",32,C["paper"],True)
    d.line([(720,299),(720,339)],arrow=True)
    d.text(505,355,"设置 → 插件 → 组件",31,C["ink"],True)
    d.line([(720,403),(720,425),(363,425),(363,449)],arrow=True)
    d.line([(720,403),(720,425),(1074,425),(1074,449)],arrow=True)
    d.box(64,452,600,168,"TeamManeger 管理组件","启用后提供 Skill 与 Subagent 管理\n词条开关、备注、编辑、新建与导入")
    d.box(776,452,600,168,"会话回收站组件","dsh-team-manager/recycle\n默认关闭，在组件条目上启用",tone="green")
    d.line([(364,621),(364,663)],arrow=True)
    d.line([(1076,621),(1076,663)],C["green"],arrow=True)
    d.box(64,666,600,159,"设置 → TeamManeger","打开 Skill / Subagent 页签\n备注就地改，其他区域进入编辑")
    d.box(776,666,600,159,"侧栏 → 回收站按钮","恢复会话、彻底删除、清空\n在回收站内设置保留天数",tone="green")
    d.text(66,860,"两个组件独立开关，属于同一安装包；管理页面不额外放回收站控制区。",24,C["muted"])
    d.save("01-entry-map")


def skill():
    d = Diagram("Skill 词条：点哪里，做什么？", "备注直接编辑，按钮各自操作；标题和其他空白区域打开完整编辑器。", 2)
    d.rect(64,228,564,506)
    d.rect(86,250,520,120,"pale",None)
    d.text(110,276,"① 名称 / 标题 / 其他空白",29,C["blue"],True)
    d.text(110,326,"点击进入完整词条编辑器",23,C["muted"])
    d.rect(86,391,520,126,"gpale",None)
    d.text(110,415,"② 备注输入框",29,C["green"],True)
    d.text(110,466,"用一句话写用途或使用场景",23,C["muted"])
    d.rect(86,540,520,170,"apale",None)
    d.text(110,563,"③ 功能按钮",29,C["amber"],True)
    d.text(110,617,"启用 / 关闭　　自动调用 / 自动关",23,C["muted"])
    d.text(110,659,"删除（另有确认）",23,C["muted"])
    d.line([(629,309),(690,309)],arrow=True)
    d.line([(629,455),(690,455)],C["green"],arrow=True)
    d.line([(629,625),(690,625)],C["amber"],arrow=True)
    d.box(710,246,666,127,"完整编辑","修改技能内容前，确认影响范围。")
    d.box(710,398,666,165,"就地改备注","输入后按 Enter 或移开焦点保存。\n独立写入 notes.json，不修改技能正文。",tone="green")
    d.box(710,588,666,127,"按钮独立响应","点击只执行该按钮操作，不打开编辑器。",tone="amber")
    d.rect(64,784,1312,83,"pale",None)
    d.text(90,810,"自动调用按任务与技能 description 匹配；备注不参与自动匹配。",27,C["blue"],True)
    d.save("02-skill-actions")


def subagent():
    d = Diagram("Subagent：从设定到派发", "每个成员可独立使用；团队分工按任务选择，不要求五人全部出场。", 3)
    steps = [
      ("1  新建 / 导入", "设置 → TeamManeger → Subagent"),
      ("2  配置身份与运行方式", "名称、描述、模型、思考级别与派生选项"),
      ("3  填写角色设定", "职责、边界、工作方式、验收与交接"),
      ("4  保存并派发", "调用 run_subagent，传入完整任务上下文"),
    ]
    for i,(title,body) in enumerate(steps):
        y = 225+i*151
        d.box(64,y,716,123,title,body)
        if i<3:
            d.line([(420,y+124),(420,y+147)],arrow=True)
    d.rect(826,225,550,576)
    d.text(852,249,"可选通用成员模板",30,C["ink"],True)
    for i,(who,role) in enumerate([("Limo","需求与架构"),("Peter","后端与领域逻辑"),("Tom","前端与交互"),("Kare","视觉与动画素材"),("Alice","独立审查与验收")]):
        y=320+i*77
        d.text(856,y,who,26,C["blue"],True)
        d.text(970,y,role,26,C["ink"])
    d.paragraph(852,729,"示例未绑定本机模型渠道，导入后可自行配置。",490,22,C["muted"])
    d.text(66,850,"关闭派生 = 叶子代理；数量上限只约束走 run_subagent 的直接下级。",24,C["muted"])
    d.save("03-subagent-setup")


def recycle():
    d = Diagram("会话回收站：删除、恢复与清理", "先在组件页启用「会话回收站」，再通过侧栏回收站按钮查看记录。", 4)
    d.box(64,228,394,145,"1  会话菜单 → 删除","选择要移入回收站的会话。")
    d.box(523,228,394,145,"2  确认移入回收站","保留可恢复记录与原数据。")
    d.box(982,228,394,145,"3  侧栏 → 回收站","查看记录与剩余保留时间。")
    d.line([(459,300),(517,300)],arrow=True)
    d.line([(918,300),(977,300)],arrow=True)
    d.line([(1179,375),(1179,414),(374,414),(374,457)],C["green"],arrow=True)
    d.line([(1179,415),(1054,415),(1054,457)],C["red"],arrow=True)
    d.box(64,460,620,183,"恢复","选择记录 → 点击恢复\n会话回到原有工作区和状态。",tone="green")
    d.box(756,460,620,183,"彻底删除 / 清空","选择删除或清空 → 二次确认\n确认后不可恢复，谨慎操作。",tone="red")
    d.rect(64,686,1312,116,"apale",None)
    d.text(90,708,"保留天数：3–30 天",29,C["amber"],True)
    d.text(90,758,"在回收站面板中设置并保存；到期记录按后台清理计划处理。",25,C["muted"])
    d.text(66,850,"关闭回收站组件会一起关闭新增删除入口，不会改为直接永久删除。",24,C["muted"])
    d.save("04-recycle-flow")

if __name__ == "__main__":
    entry(); skill(); subagent(); recycle()

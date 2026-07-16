<template>
  <div class="settings-view">
    <v-toolbar density="compact" color="surface" class="border-b">
      <v-toolbar-title>设置</v-toolbar-title>
    </v-toolbar>

    <div class="settings-content pa-4">
      <!-- ==================== 阅读设置 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="primary" class="mr-2">mdi-book-open-page-variant</v-icon>
          阅读设置
        </v-card-title>
        <v-card-text>
          <div class="settings-grid">
            <!-- 字号 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>字号</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.fontSize }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.fontSize"
                :min="12" :max="32" :step="1"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('fontSize', v)"
              />
            </div>

            <!-- 字号缩放 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>字号缩放</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.fontSizeScale > 0 ? '+' : '' }}{{ readingSettings.fontSizeScale }}%</span>
              </label>
              <v-slider
                :model-value="readingSettings.fontSizeScale"
                :min="-50" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('fontSizeScale', v)"
              />
            </div>

            <!-- 行距 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>行距</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.lineHeight.toFixed(1) }}</span>
              </label>
              <v-slider
                :model-value="readingSettings.lineHeight"
                :min="1.2" :max="3.0" :step="0.1"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('lineHeight', v)"
              />
            </div>

            <!-- 段距 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>段距</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.paragraphSpacing }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.paragraphSpacing"
                :min="0" :max="40" :step="2"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('paragraphSpacing', v)"
              />
            </div>

            <!-- 缩进 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>缩进</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.textIndent }}em</span>
              </label>
              <v-slider
                :model-value="readingSettings.textIndent"
                :min="0" :max="4" :step="0.5"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('textIndent', v)"
              />
            </div>

            <!-- 字重 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>字重</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.fontWeight }}</span>
              </label>
              <v-slider
                :model-value="readingSettings.fontWeight"
                :min="300" :max="700" :step="100"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('fontWeight', v)"
              />
            </div>

            <!-- 边距 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>边距</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.marginHorizontal }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.marginHorizontal"
                :min="0" :max="64" :step="4"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('marginHorizontal', v)"
              />
            </div>

            <!-- 页面宽度 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>页面宽度</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.pageWidth }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.pageWidth"
                :min="600" :max="1200" :step="50"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('pageWidth', v)"
              />
            </div>

            <!-- 字体 -->
            <div>
              <label class="text-caption">字体</label>
              <v-select
                :model-value="readingSettings.fontFamily === '__custom__' ? '__custom__' : fontFamilySelected.value"
                :items="FONT_FAMILY_OPTIONS"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                color="primary"
                @update:model-value="onFontFamilyChange"
              />
              <v-text-field
                v-if="isCustomFont"
                v-model="customFontValue"
                label="自定义字体 CSS"
                placeholder="'MyFont', serif"
                density="compact"
                variant="outlined"
                hide-details
                class="mt-2"
                @update:model-value="onCustomFontInput"
              />
            </div>

            <!-- 上传自定义字体 -->
            <div>
              <label class="text-caption">自定义字体文件</label>
              <input
                ref="fontInputRef"
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                style="display:none"
                @change="onFontFileSelected"
              />
              <div class="d-flex align-center gap-2">
                <v-btn size="small" variant="outlined" prepend-icon="mdi-upload" @click="triggerFontUpload">
                  选择字体
                </v-btn>
                <span class="text-caption text-medium-emphasis" v-if="!fontUploadError">支持 .ttf .otf .woff .woff2</span>
                <span class="text-caption text-error" v-else>{{ fontUploadError }}</span>
              </div>
              <div v-if="settings.customFonts.length > 0" class="mt-2">
                <v-chip
                  v-for="f in settings.customFonts"
                  :key="f.family"
                  size="small"
                  closable
                  class="mr-1 mb-1"
                  @click:close="onRemoveFont(f.family)"
                >{{ f.name }}</v-chip>
              </div>
            </div>

            <!-- 文字对齐 -->
            <div>
              <label class="text-caption">文字对齐</label>
              <v-btn-toggle
                :model-value="readingSettings.textAlign"
                mandatory density="compact"
                variant="outlined" divided
                color="primary"
                class="w-100"
                @update:model-value="(v: 'left' | 'justify') => settings.updateReadingSetting('textAlign', v)"
              >
                <v-btn value="justify" size="small" class="flex-1-0">
                  <v-icon size="18" class="mr-1">mdi-format-align-justify</v-icon>
                  两端
                </v-btn>
                <v-btn value="left" size="small" class="flex-1-0">
                  <v-icon size="18" class="mr-1">mdi-format-align-left</v-icon>
                  左对齐
                </v-btn>
              </v-btn-toggle>
            </div>

            <!-- 工具栏自动隐藏延迟 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>工具栏自动隐藏</span>
                <span class="text-primary font-weight-bold">{{ settings.toolbarAutoHideDelay }}s</span>
              </label>
              <v-slider
                :model-value="settings.toolbarAutoHideDelay"
                :min="1" :max="10" :step="1"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.setToolbarAutoHideDelay(v)"
              />
            </div>

            <!-- 自动滚屏速度 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>自动滚屏速度</span>
                <span class="text-primary font-weight-bold">{{ settings.autoScrollSpeed }}</span>
              </label>
              <v-slider
                :model-value="settings.autoScrollSpeed"
                :min="10" :max="100" :step="5"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.setAutoScrollSpeed(v)"
              />
            </div>
          </div>

          <!-- Toggles -->
          <div class="d-flex flex-wrap gap-4 mt-4 pt-2 border-t">
            <v-switch
              :model-value="readingSettings.showChapterTitle"
              color="primary"
              label="显示章节标题"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('showChapterTitle', v)"
            />
            <v-switch
              :model-value="readingSettings.hyphenation"
              color="primary"
              label="英文断字 (Hyphenation)"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('hyphenation', v)"
            />
            <v-switch
              :model-value="readingSettings.firstLineIndent"
              color="primary"
              label="首行缩进"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('firstLineIndent', v)"
            />
            <v-switch
              :model-value="readingSettings.verticalText"
              color="primary"
              label="竖排文字"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('verticalText', v)"
            />
            <v-switch
              :model-value="readingSettings.hideScrollbar"
              color="primary"
              label="隐藏滚动条"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('hideScrollbar', v)"
            />
            <v-switch
              :model-value="readingSettings.dimBackground"
              color="primary"
              label="调暗背景"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('dimBackground', v)"
            />
            <v-switch
              :model-value="readingSettings.lineFocus"
              color="primary"
              label="行聚焦模式"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('lineFocus', v)"
            />
          </div>

          <!-- Advanced reading settings -->
          <div class="settings-grid mt-4 pt-2 border-t">
            <!-- 字间距 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>字间距</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.letterSpacing }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.letterSpacing"
                :min="0" :max="5" :step="0.5"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('letterSpacing', v)"
              />
            </div>

            <!-- 词间距 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>词间距</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.wordSpacing }}px</span>
              </label>
              <v-slider
                :model-value="readingSettings.wordSpacing"
                :min="0" :max="10" :step="1"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('wordSpacing', v)"
              />
            </div>

            <!-- 分栏数 -->
            <div>
              <label class="text-caption">分栏数</label>
              <v-btn-toggle
                :model-value="readingSettings.columnCount"
                mandatory density="compact"
                variant="outlined" divided
                color="primary"
                class="w-100"
                @update:model-value="(v: number) => settings.updateReadingSetting('columnCount', v)"
              >
                <v-btn :value="1" size="small" class="flex-1-0">1栏</v-btn>
                <v-btn :value="2" size="small" class="flex-1-0">2栏</v-btn>
                <v-btn :value="3" size="small" class="flex-1-0">3栏</v-btn>
              </v-btn-toggle>
            </div>

            <!-- 阅读区宽度 -->
            <div>
              <label class="text-caption">阅读区宽度</label>
              <v-btn-toggle
                :model-value="readingSettings.readingWidth"
                mandatory density="compact"
                variant="outlined" divided
                color="primary"
                class="w-100"
                @update:model-value="(v: string) => settings.updateReadingSetting('readingWidth', v)"
              >
                <v-btn value="narrow" size="small" class="flex-1-0">窄</v-btn>
                <v-btn value="medium" size="small" class="flex-1-0">中</v-btn>
                <v-btn value="wide" size="small" class="flex-1-0">宽</v-btn>
                <v-btn value="full" size="small" class="flex-1-0">全屏</v-btn>
              </v-btn-toggle>
            </div>

            <!-- 翻页动画 -->
            <div>
              <label class="text-caption">翻页动画</label>
              <v-btn-toggle
                :model-value="readingSettings.pageAnimation"
                mandatory density="compact"
                variant="outlined" divided
                color="primary"
                class="w-100"
                @update:model-value="(v: string) => settings.updateReadingSetting('pageAnimation', v)"
              >
                <v-btn value="none" size="small" class="flex-1-0">无</v-btn>
                <v-btn value="slide" size="small" class="flex-1-0">滑动</v-btn>
                <v-btn value="fade" size="small" class="flex-1-0">淡入淡出</v-btn>
                <v-btn value="flip" size="small" class="flex-1-0">翻转</v-btn>
              </v-btn-toggle>
            </div>

            <!-- 护眼强度 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>护眼强度</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.sepiaIntensity }}%</span>
              </label>
              <v-slider
                :model-value="readingSettings.sepiaIntensity"
                :min="0" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('sepiaIntensity', v)"
              />
            </div>

            <!-- 亮度 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>亮度</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.brightness }}%</span>
              </label>
              <v-slider
                :model-value="readingSettings.brightness"
                :min="50" :max="150" :step="5"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('brightness', v)"
              />
            </div>

            <!-- 对比度 -->
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>对比度</span>
                <span class="text-primary font-weight-bold">{{ readingSettings.contrast }}%</span>
              </label>
              <v-slider
                :model-value="readingSettings.contrast"
                :min="50" :max="150" :step="5"
                hide-details density="compact" thumb-label
                color="primary"
                @update:model-value="(v: number) => settings.updateReadingSetting('contrast', v)"
              />
            </div>
          </div>

          <v-btn
            color="warning"
            variant="text"
            size="small"
            class="mt-4"
            prepend-icon="mdi-restore"
            @click="settings.resetReadingSettings()"
          >
            恢复默认阅读设置
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- ==================== 个性化 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="secondary" class="mr-2">mdi-palette-swatch</v-icon>
          个性化
        </v-card-title>
        <v-card-text>
          <!-- 主题模式 -->
          <p class="text-caption text-medium-emphasis mb-2">主题模式</p>
          <v-btn-toggle
            :model-value="theme.current"
            mandatory divided
            variant="outlined"
            class="mb-4"
            @update:model-value="(v: string) => theme.setTheme(v as ThemeMode)"
          >
            <v-btn value="light" prepend-icon="mdi-white-balance-sunny" size="small">明亮</v-btn>
            <v-btn value="dark" prepend-icon="mdi-weather-night" size="small">暗黑</v-btn>
            <v-btn value="sepia" prepend-icon="mdi-palette" size="small">护眼</v-btn>
          </v-btn-toggle>

          <!-- 主题颜色 -->
          <p class="text-caption text-medium-emphasis mb-2">主题配色</p>
          <div class="color-pickers-grid mb-4">
            <div>
              <label class="text-caption">主色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="settings.themeColors.primary"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerColorPicker('primaryPicker')"
                />
                <input
                  ref="primaryPicker"
                  type="color"
                  :value="settings.themeColors.primary"
                  class="hidden-picker"
                  @input="(e: Event) => settings.setThemeColor('primary', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ settings.themeColors.primary }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">辅色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="settings.themeColors.secondary"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerColorPicker('secondaryPicker')"
                />
                <input
                  ref="secondaryPicker"
                  type="color"
                  :value="settings.themeColors.secondary"
                  class="hidden-picker"
                  @input="(e: Event) => settings.setThemeColor('secondary', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ settings.themeColors.secondary }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">强调色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="settings.themeColors.accent"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerColorPicker('accentPicker')"
                />
                <input
                  ref="accentPicker"
                  type="color"
                  :value="settings.themeColors.accent"
                  class="hidden-picker"
                  @input="(e: Event) => settings.setThemeColor('accent', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ settings.themeColors.accent }}</span>
              </div>
            </div>
          </div>

          <!-- 阅读背景色 & 文字颜色 -->
          <p class="text-caption text-medium-emphasis mb-2">阅读区配色</p>
          <div class="color-pickers-grid mb-4">
            <div>
              <label class="text-caption">背景色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="settings.themeColors.bgColor"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerColorPicker('bgPicker')"
                />
                <input
                  ref="bgPicker"
                  type="color"
                  :value="settings.themeColors.bgColor"
                  class="hidden-picker"
                  @input="(e: Event) => settings.setThemeColor('bgColor', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ settings.themeColors.bgColor }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">文字色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="settings.themeColors.textColor"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerColorPicker('textPicker')"
                />
                <input
                  ref="textPicker"
                  type="color"
                  :value="settings.themeColors.textColor"
                  class="hidden-picker"
                  @input="(e: Event) => settings.setThemeColor('textColor', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ settings.themeColors.textColor }}</span>
              </div>
            </div>
          </div>

          <v-btn
            color="warning"
            variant="text"
            size="small"
            prepend-icon="mdi-restore"
            @click="settings.resetThemeColors()"
          >
            恢复默认配色
          </v-btn>

          <v-divider class="my-4" />

          <!-- ===== 主题颜色自定义（每主题独立） ===== -->
          <p class="text-caption font-weight-bold mb-2">主题颜色自定义</p>

          <!-- 当前主题预览 -->
          <div class="d-flex align-center gap-2 mb-3">
            <span class="text-caption text-medium-emphasis mr-1">当前主题预览</span>
            <v-sheet
              :color="getCustomThemeColor(theme.current, 'primary')"
              width="40" height="24" class="rounded" elevation="1"
            />
            <v-sheet
              :color="getCustomThemeColor(theme.current, 'surface')"
              width="40" height="24" class="rounded" elevation="1"
            />
            <v-sheet
              :color="getCustomThemeColor(theme.current, 'background')"
              width="40" height="24" class="rounded" elevation="1"
            />
            <v-sheet
              :color="getCustomThemeColor(theme.current, 'textColor')"
              width="40" height="24" class="rounded" elevation="1"
            />
            <span class="text-caption text-medium-emphasis ml-1">主色 · 表面 · 背景 · 文字</span>
          </div>

          <!-- 选择要编辑的主题 -->
          <v-btn-toggle
            v-model="customizeThemeTarget"
            mandatory divided
            variant="outlined"
            density="compact"
            class="mb-3"
          >
            <v-btn value="light" size="x-small">明亮</v-btn>
            <v-btn value="dark" size="x-small">暗黑</v-btn>
            <v-btn value="sepia" size="x-small">护眼</v-btn>
          </v-btn-toggle>

          <!-- 编辑区 -->
          <div class="color-pickers-grid mb-3">
            <div>
              <label class="text-caption">主色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="getCustomThemeColor(customizeThemeTarget, 'primary')"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerCustomColorPicker('customPrimaryPicker')"
                />
                <input
                  ref="customPrimaryPicker"
                  type="color"
                  :value="getCustomThemeColor(customizeThemeTarget, 'primary')"
                  class="hidden-picker"
                  @input="(e: Event) => onCustomThemeColorChange('primary', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ getCustomThemeColor(customizeThemeTarget, 'primary') }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">表面色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="getCustomThemeColor(customizeThemeTarget, 'surface')"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerCustomColorPicker('customSurfacePicker')"
                />
                <input
                  ref="customSurfacePicker"
                  type="color"
                  :value="getCustomThemeColor(customizeThemeTarget, 'surface')"
                  class="hidden-picker"
                  @input="(e: Event) => onCustomThemeColorChange('surface', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ getCustomThemeColor(customizeThemeTarget, 'surface') }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">背景色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="getCustomThemeColor(customizeThemeTarget, 'background')"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerCustomColorPicker('customBgPicker')"
                />
                <input
                  ref="customBgPicker"
                  type="color"
                  :value="getCustomThemeColor(customizeThemeTarget, 'background')"
                  class="hidden-picker"
                  @input="(e: Event) => onCustomThemeColorChange('background', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ getCustomThemeColor(customizeThemeTarget, 'background') }}</span>
              </div>
            </div>
            <div>
              <label class="text-caption">文字色</label>
              <div class="d-flex align-center gap-2">
                <v-sheet
                  :color="getCustomThemeColor(customizeThemeTarget, 'textColor')"
                  width="32" height="32"
                  class="rounded-circle color-swatch"
                  elevation="1"
                  @click="triggerCustomColorPicker('customTextPicker')"
                />
                <input
                  ref="customTextPicker"
                  type="color"
                  :value="getCustomThemeColor(customizeThemeTarget, 'textColor')"
                  class="hidden-picker"
                  @input="(e: Event) => onCustomThemeColorChange('textColor', (e.target as HTMLInputElement).value)"
                />
                <span class="text-caption mono">{{ getCustomThemeColor(customizeThemeTarget, 'textColor') }}</span>
              </div>
            </div>
          </div>

          <div class="d-flex gap-2">
            <v-btn
              color="warning"
              variant="text"
              size="small"
              prepend-icon="mdi-restore"
              @click="resetCustomThemeColors"
            >
              恢复默认主题
            </v-btn>
            <v-btn
              color="warning"
              variant="text"
              size="small"
              prepend-icon="mdi-restore-alert"
              @click="resetAllCustomThemeColors"
            >
              恢复全部默认主题
            </v-btn>
          </div>

          <v-divider class="my-4" />

          <!-- 背景图片 -->
          <p class="text-caption text-medium-emphasis mb-2">背景图片</p>
          <v-text-field
            :model-value="settings.readingSettings.bgImageUrl"
            label="背景图片 URL（留空则使用纯色）"
            placeholder="https://example.com/bg.jpg"
            density="compact"
            variant="outlined"
            hide-details
            class="mb-4"
            clearable
            @update:model-value="(v: string) => settings.updateReadingSetting('bgImageUrl', (v && /^(https?:\/\/|data:)/i.test(v.trim())) ? v.trim() : '')"
          />

          <!-- 背景透明度 -->
          <p class="text-caption text-medium-emphasis mb-2">背景不透明度</p>
          <v-slider
            :model-value="settings.readingSettings.bgOpacity"
            :min="0.1" :max="1.0" :step="0.05"
            hide-details density="compact" thumb-label
            color="primary"
            class="mb-4"
            @update:model-value="(v: number) => settings.updateReadingSetting('bgOpacity', v)"
          >
            <template #prepend>
              <v-icon size="16" color="medium-emphasis">mdi-opacity</v-icon>
            </template>
          </v-slider>

          <!-- 自定义 CSS -->
          <p class="text-caption text-medium-emphasis mb-2">自定义 CSS（高级）</p>
          <v-textarea
            :model-value="settings.readingSettings.customCSS"
            label="输入自定义 CSS 样式覆盖阅读区"
            placeholder=".reader-content p { letter-spacing: 0.05em; }"
            density="compact"
            variant="outlined"
            hide-details
            rows="4"
            class="mb-4"
            @update:model-value="(v: string) => settings.updateReadingSetting('customCSS', v)"
          />

          <!-- Toggles for personalization -->
          <div class="d-flex flex-wrap gap-4">
            <v-switch
              :model-value="settings.readingSettings.showReadingStats"
              color="primary"
              label="显示阅读统计"
              density="compact"
              hide-details
              @update:model-value="(v: boolean | null) => v != null && settings.updateReadingSetting('showReadingStats', v)"
            />
          </div>

          <!-- 自动保存间隔 -->
          <div class="mt-4">
            <label class="text-caption d-flex justify-space-between">
              <span>自动保存阅读进度</span>
              <span class="text-primary font-weight-bold">{{ settings.readingSettings.autoSaveInterval }}s</span>
            </label>
            <v-slider
              :model-value="settings.readingSettings.autoSaveInterval"
              :min="5" :max="60" :step="5"
              hide-details density="compact" thumb-label
              color="primary"
              @update:model-value="(v: number) => settings.updateReadingSetting('autoSaveInterval', v)"
            />
          </div>

          <v-divider class="my-4" />

          <!-- 分页设置 -->
          <p class="text-caption font-weight-bold mb-2">分页设置</p>
          <div class="settings-grid">
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>书架每页显示</span>
                <span class="text-primary font-weight-bold">{{ pageSizes.bookshelf }}条</span>
              </label>
              <v-slider
                v-model="pageSizes.bookshelf"
                :min="10" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                show-ticks="always"
                :ticks="{ 10: '10', 20: '20', 30: '30', 50: '50', 100: '100' }"
                @end="savePageSizes"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>笔记每页显示</span>
                <span class="text-primary font-weight-bold">{{ pageSizes.notes }}条</span>
              </label>
              <v-slider
                v-model="pageSizes.notes"
                :min="10" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                show-ticks="always"
                :ticks="{ 10: '10', 20: '20', 30: '30', 50: '50', 100: '100' }"
                @end="savePageSizes"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>历史每页显示</span>
                <span class="text-primary font-weight-bold">{{ pageSizes.history }}条</span>
              </label>
              <v-slider
                v-model="pageSizes.history"
                :min="10" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                show-ticks="always"
                :ticks="{ 10: '10', 20: '20', 30: '30', 50: '50', 100: '100' }"
                @end="savePageSizes"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>回收站每页显示</span>
                <span class="text-primary font-weight-bold">{{ pageSizes.trash }}条</span>
              </label>
              <v-slider
                v-model="pageSizes.trash"
                :min="10" :max="100" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                show-ticks="always"
                :ticks="{ 10: '10', 20: '20', 30: '30', 50: '50', 100: '100' }"
                @end="savePageSizes"
              />
            </div>
          </div>
        </v-card-text>
      </v-card>

      <!-- ==================== 快捷键 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="info" class="mr-2">mdi-keyboard</v-icon>
          快捷键
        </v-card-title>
        <v-card-text>
          <!-- 冲突警告 -->
          <v-alert
            v-if="shortcutConflicts.length > 0"
            type="error"
            density="compact"
            variant="tonal"
            class="mb-3"
            closable
          >
            <template #title>
              <v-icon size="16" class="mr-1">mdi-alert-circle</v-icon>
              快捷键冲突检测：以下快捷键绑定相同，可能导致功能异常
            </template>
            <div v-for="conflict in shortcutConflicts" :key="conflict.binding" class="mt-1">
              <span class="shortcut-kbd">
                <v-chip
                  v-for="(part, pi) in conflict.binding.split('+')"
                  :key="pi"
                  size="x-small"
                  density="compact"
                  color="error"
                  variant="flat"
                  class="kbd-chip"
                >{{ part }}</v-chip>
              </span>
              <span class="text-caption ml-1">
                同时绑定到：
                <strong v-for="(name, i) in conflict.names" :key="name">
                  {{ name }}<template v-if="i < conflict.names.length - 1">、</template>
                </strong>
              </span>
            </div>
          </v-alert>

          <!-- 当前快捷键总览 -->
          <p class="text-caption font-weight-bold mb-2">
            <v-icon size="14" class="mr-1">mdi-view-dashboard</v-icon>
            当前快捷键总览
          </p>
          <div class="d-flex flex-wrap gap-3 mb-4">
            <!-- 全局快捷键卡片 -->
            <v-card variant="outlined" class="flex-1-0 pa-3" min-width="220">
              <div class="text-caption font-weight-bold mb-2">
                <v-icon size="14" color="primary" class="mr-1">mdi-monitor</v-icon>全局快捷键
              </div>
              <div
                v-for="s in globalShortcutDefs"
                :key="s.key"
                class="d-flex align-center justify-space-between mb-1"
              >
                <span class="text-caption">{{ s.label }}</span>
                <span class="shortcut-kbd">
                  <v-chip
                    v-for="(part, pi) in (shortcuts[s.key] || '').split('+')"
                    :key="pi"
                    size="x-small"
                    density="compact"
                    :color="isBindingConflicting(shortcuts[s.key]) ? 'error' : 'primary'"
                    variant="flat"
                    class="kbd-chip mr-0"
                  >{{ part }}</v-chip>
                </span>
              </div>
            </v-card>

            <!-- 阅读器快捷键卡片 -->
            <v-card variant="outlined" class="flex-1-0 pa-3" min-width="280">
              <div class="text-caption font-weight-bold mb-2">
                <v-icon size="14" color="secondary" class="mr-1">mdi-book-open-outline</v-icon>阅读器快捷键
              </div>
              <div
                v-for="s in readingShortcutDefs"
                :key="s.key"
                class="d-flex align-center justify-space-between mb-1"
              >
                <span class="text-caption">{{ s.label }}</span>
                <span class="shortcut-kbd">
                  <v-chip
                    v-for="(part, pi) in (settings.readingShortcuts[s.key] || '').split('+')"
                    :key="pi"
                    size="x-small"
                    density="compact"
                    :color="isBindingConflicting(settings.readingShortcuts[s.key]) ? 'error' : 'secondary'"
                    variant="flat"
                    class="kbd-chip mr-0"
                  >{{ part }}</v-chip>
                </span>
              </div>
            </v-card>
          </div>

          <v-divider class="my-3" />

          <!-- 编辑区 -->
          <p class="text-caption text-medium-emphasis mb-3">点击输入框后按下组合键即可捕获，立即生效。</p>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-caption">功能</th>
                <th class="text-caption">快捷键</th>
                <th class="text-caption">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in globalShortcutDefs" :key="s.key">
                <td>{{ s.label }}</td>
                <td>
                  <v-text-field
                    :model-value="capturingShortcut === s.key ? '按下快捷键...' : shortcuts[s.key]"
                    density="compact"
                    variant="outlined"
                    hide-details
                    readonly
                    style="max-width:140px"
                    :class="{ 'shortcut-capturing': capturingShortcut === s.key }"
                    @focus="startCapture(s.key)"
                    @blur="stopCapture"
                    @keydown.prevent="(e: KeyboardEvent) => captureShortcut(s.key, e)"
                  />
                </td>
                <td><v-chip size="x-small">{{ s.desc }}</v-chip></td>
              </tr>
            </tbody>
          </v-table>

          <v-divider class="my-3" />

          <p class="text-caption font-weight-bold mb-2">阅读导航快捷键</p>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-caption">功能</th>
                <th class="text-caption">快捷键</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in readingShortcutDefs" :key="s.key">
                <td>{{ s.label }}</td>
                <td>
                  <v-text-field
                    :model-value="capturingShortcut === s.key ? '按下快捷键...' : settings.readingShortcuts[s.key]"
                    density="compact"
                    variant="outlined"
                    hide-details
                    readonly
                    style="max-width:140px"
                    :class="{ 'shortcut-capturing': capturingShortcut === s.key }"
                    @focus="startCapture(s.key)"
                    @blur="stopCapture"
                    @keydown.prevent="(e: KeyboardEvent) => captureShortcut(s.key, e)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-btn
            color="warning"
            variant="text"
            size="small"
            class="mt-4"
            prepend-icon="mdi-restore"
            @click="resetAllShortcuts"
          >
            重置所有快捷键
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- ==================== 安全 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="error" class="mr-2">mdi-shield-lock</v-icon>
          安全
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="pinMessage"
            :type="pinMessageType"
            density="compact"
            class="mb-3"
            closable
            @click:close="pinMessage = ''"
          >
            {{ pinMessage }}
          </v-alert>

          <!-- PIN 码状态 -->
          <div class="d-flex align-center gap-2 mb-3">
            <v-icon :color="pinIsSet ? 'success' : 'medium-emphasis'" size="20">
              {{ pinIsSet ? 'mdi-shield-check' : 'mdi-shield-off-outline' }}
            </v-icon>
            <span class="text-body-2">
              {{ pinIsSet ? 'PIN 码保护已启用' : 'PIN 码保护未启用 — 设置以保护您的阅读数据' }}
            </span>
          </div>

          <!-- PIN 码设置区 -->
          <div v-if="!pinIsSet" class="mb-4">
            <v-text-field
              v-model="newPin"
              :type="showNewPin ? 'text' : 'password'"
              label="新 PIN 码"
              placeholder="4-32 位"
              variant="outlined"
              density="compact"
              class="mb-2"
              maxlength="32"
              :append-inner-icon="showNewPin ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showNewPin = !showNewPin"
            />
            <v-text-field
              v-model="confirmPin"
              :type="showNewPin ? 'text' : 'password'"
              label="确认 PIN 码"
              placeholder="再次输入"
              variant="outlined"
              density="compact"
              class="mb-2"
              maxlength="32"
              :error="pinError"
              :error-messages="pinError ? pinErrorMessage : ''"
            />
            <v-btn
              color="primary"
              size="small"
              prepend-icon="mdi-shield-check"
              @click="setNewPin"
              :loading="pinLoading"
              :disabled="!newPin || newPin.length < 4"
            >
              启用 PIN 码
            </v-btn>
          </div>

          <!-- 已设置 PIN 时显示操作 -->
          <div v-if="pinIsSet" class="mb-4">
            <div class="d-flex flex-wrap gap-2 mb-3">
              <v-btn
                color="warning"
                variant="outlined"
                size="small"
                prepend-icon="mdi-shield-off"
                @click="showRemovePinDialog = true"
              >
                关闭 PIN 码
              </v-btn>
              <v-btn
                color="primary"
                variant="outlined"
                size="small"
                prepend-icon="mdi-shield-refresh"
                @click="showChangePin = !showChangePin"
              >
                {{ showChangePin ? '取消修改' : '修改 PIN 码' }}
              </v-btn>
            </div>

            <!-- 修改 PIN -->
            <div v-if="showChangePin" class="pa-3 border rounded mb-3">
              <p class="text-caption mb-2">修改 PIN 码（需输入当前 PIN）</p>
              <v-text-field
                v-model="currentPinForChange"
                type="password"
                label="当前 PIN 码"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
              <v-text-field
                v-model="newPinForChange"
                :type="showNewPin ? 'text' : 'password'"
                label="新 PIN 码"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
              <v-text-field
                v-model="confirmNewPinForChange"
                :type="showNewPin ? 'text' : 'password'"
                label="确认新 PIN 码"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
              <v-btn
                color="primary"
                size="small"
                @click="changePin"
                :loading="pinLoading"
                :disabled="!currentPinForChange || !newPinForChange || newPinForChange.length < 4"
              >
                确认修改
              </v-btn>
            </div>
          </div>

          <v-divider class="my-3" />

          <!-- 安全问题 -->
          <p class="text-caption font-weight-bold mb-2">安全问题（用于 PIN 码重置）</p>
          <div class="mb-3">
            <v-select
              v-model="securityQuestionSelected"
              :items="SECURITY_QUESTIONS"
              label="选择安全问题"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
            <v-text-field
              v-if="securityQuestionSelected === '自定义问题'"
              v-model="customSecurityQuestion"
              label="输入自定义问题"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
            <v-text-field
              v-model="securityAnswer"
              label="答案"
              type="password"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
              :append-inner-icon="showSecurityAnswer ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showSecurityAnswer = !showSecurityAnswer"
            />
            <v-btn
              color="primary"
              size="small"
              prepend-icon="mdi-content-save"
              :disabled="!canSaveSecurity"
              :loading="secSaving"
              @click="saveSecurityQuestion"
            >
              保存安全问题
            </v-btn>
          </div>

          <!-- 通过安全问题重置 PIN -->
          <div v-if="pinIsSet" class="mt-2">
            <v-btn
              color="error"
              variant="text"
              size="small"
              prepend-icon="mdi-lock-reset"
              @click="showPinReset = !showPinReset"
            >
              {{ showPinReset ? '取消重置' : '通过安全问题重置 PIN' }}
            </v-btn>
            <div v-if="showPinReset" class="pa-3 border rounded mt-2">
              <p class="text-caption mb-2">回答您之前设置的安全问题以重置 PIN 码</p>
              <p class="text-body-2 font-weight-bold mb-2">{{ savedSecurityQuestion }}</p>
              <v-text-field
                v-model="pinResetAnswer"
                label="答案"
                type="password"
                density="compact"
                variant="outlined"
                hide-details
                class="mb-2"
              />
              <v-btn
                color="error"
                size="small"
                :loading="pinResetLoading"
                :disabled="!pinResetAnswer"
                @click="resetPinBySecurity"
              >
                重置 PIN 码
              </v-btn>
            </div>
          </div>

          <v-divider class="my-3" />

          <!-- PIN 锁定升级设置 -->
          <p class="text-caption font-weight-bold mb-2">锁定升级设置</p>
          <div class="settings-grid">
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>错误次数后锁定</span>
                <span class="text-primary font-weight-bold">{{ pinEscalation.firstAttempts }} 次</span>
              </label>
              <v-slider
                v-model="pinEscalation.firstAttempts"
                :min="1" :max="10" :step="1"
                hide-details density="compact" thumb-label
                color="primary"
                @end="savePinEscalation"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>锁定时间</span>
                <span class="text-primary font-weight-bold">{{ pinEscalation.firstLockDuration }}s</span>
              </label>
              <v-slider
                v-model="pinEscalation.firstLockDuration"
                :min="10" :max="600" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                @end="savePinEscalation"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>第二次锁定次数</span>
                <span class="text-primary font-weight-bold">{{ pinEscalation.secondAttempts }} 次</span>
              </label>
              <v-slider
                v-model="pinEscalation.secondAttempts"
                :min="1" :max="10" :step="1"
                hide-details density="compact" thumb-label
                color="primary"
                @end="savePinEscalation"
              />
            </div>
            <div>
              <label class="text-caption d-flex justify-space-between">
                <span>第二次锁定时间</span>
                <span class="text-primary font-weight-bold">{{ pinEscalation.secondLockDuration }}s</span>
              </label>
              <v-slider
                v-model="pinEscalation.secondLockDuration"
                :min="10" :max="600" :step="10"
                hide-details density="compact" thumb-label
                color="primary"
                @end="savePinEscalation"
              />
            </div>
          </div>

          <v-divider class="my-3" />

          <p class="text-caption text-medium-emphasis">
            <v-icon size="14">mdi-information</v-icon>
            PIN 码使用 SHA-256 + PBKDF2（60万次迭代）保护，数据使用 AES-256-GCM 加密。
            首次{{ pinEscalation.firstAttempts }}次错误后锁定{{ pinEscalation.firstLockDuration }}秒，第二次再加{{ pinEscalation.secondAttempts }}次错误后锁定{{ pinEscalation.secondLockDuration }}秒。
          </p>
        </v-card-text>
      </v-card>

      <!-- ==================== 数据与缓存 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="warning" class="mr-2">mdi-database-cog</v-icon>
          数据与缓存
        </v-card-title>
        <v-card-text>
          <!-- 数据管理操作 -->
          <p class="text-caption font-weight-bold mb-2">数据管理</p>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              prepend-icon="mdi-export"
              @click="exportData"
              :loading="exporting"
            >
              导出备份
              <template v-if="exporting" #loader>
                <v-progress-circular indeterminate size="14" width="2" />
              </template>
            </v-btn>

            <v-btn
              color="secondary"
              variant="outlined"
              size="small"
              prepend-icon="mdi-format-annotation-plus"
              @click="showExportAnnotations = true"
            >
              导出标注
            </v-btn>

            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              prepend-icon="mdi-import"
              @click="importData"
              :loading="importing"
            >
              导入恢复
            </v-btn>

            <v-btn
              color="warning"
              variant="outlined"
              size="small"
              prepend-icon="mdi-refresh"
              @click="refreshMetadata"
              :loading="refreshing"
            >
              刷新元数据
            </v-btn>

            <v-btn
              color="warning"
              variant="outlined"
              size="small"
              prepend-icon="mdi-delete-restore"
              :loading="dataOpInProgress"
              @click="cleanupOrphanedData"
            >
              清理失效数据
            </v-btn>
            <v-btn
              color="error"
              variant="outlined"
              size="small"
              prepend-icon="mdi-delete-sweep"
              @click="showClearAll = true"
            >
              清除全部数据
            </v-btn>
          </div>

          <!-- Progress indicator -->
          <div v-if="dataOpInProgress" class="mt-2 mb-3">
            <v-progress-linear
              :model-value="dataOpProgress"
              color="primary"
              height="4"
              rounded
              :indeterminate="dataOpIndeterminate"
            />
            <p class="text-caption text-medium-emphasis mt-1">{{ dataOpLabel }}</p>
          </div>

          <v-divider class="my-3" />

          <!-- 缓存管理 -->
          <p class="text-caption font-weight-bold mb-2">缓存管理</p>
          <div class="d-flex align-center gap-2 mb-3">
            <span class="text-body-2">缓存大小：</span>
            <span class="text-body-2 font-weight-bold">{{ cacheSizeStr }}</span>
            <v-btn
              variant="text"
              size="x-small"
              icon="mdi-refresh"
              :loading="cacheSizeCalculating"
              @click="estimateCacheSize"
            />
          </div>

          <v-btn
            color="warning"
            variant="outlined"
            size="small"
            prepend-icon="mdi-delete-sweep"
            @click="showCacheClearDialog = true"
            :disabled="cacheSize === 0"
          >
            清除缓存
          </v-btn>

          <p class="text-caption text-medium-emphasis mt-2">
            <v-icon size="14">mdi-information</v-icon>
            清除缓存会移除临时文件与缩略图，不影响您的书籍与阅读进度。
          </p>
        </v-card-text>
      </v-card>

      <!-- ==================== WebDAV 备份 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="blue" class="mr-2">mdi-cloud-sync</v-icon>
          WebDAV 备份
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="webdavMessage"
            :type="webdavMessageType"
            density="compact"
            class="mb-3"
            closable
            @click:close="webdavMessage = ''"
          >
            {{ webdavMessage }}
          </v-alert>

          <div class="settings-grid">
            <div>
              <v-text-field
                v-model="webdavUrl"
                label="WebDAV 服务器 URL"
                placeholder="https://dav.example.com/remote.php/dav/files/username/x-reader-plus"
                density="compact"
                variant="outlined"
                hide-details
                @update:model-value="onWebdavConfigChange"
              />
            </div>
            <div>
              <v-text-field
                v-model="webdavUsername"
                label="用户名"
                density="compact"
                variant="outlined"
                hide-details
                @update:model-value="onWebdavConfigChange"
              />
            </div>

            <div>
              <v-text-field
                v-model="webdavPassword"
                label="服务器密码"
                type="password"
                density="compact"
                variant="outlined"
                hide-details
                :append-inner-icon="webdavShowPwd ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="webdavShowPwd = !webdavShowPwd"
                @update:model-value="onWebdavConfigChange"
              />
              <p class="text-caption text-medium-emphasis mt-1">用于连接 WebDAV 服务器（Basic Auth）</p>
            </div>

            <div>
              <label class="text-caption">自动备份</label>
              <v-select
                v-model="webdavAutoBackupInterval"
                :items="WEBDAV_INTERVAL_OPTIONS"
                item-title="label"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                @update:model-value="onWebdavConfigChange"
              />
            </div>
          </div>

          <!-- 文件加密 -->
          <div class="mt-4">
            <div class="text-subtitle-2 mb-2">文件加密</div>
            <p class="text-caption text-medium-emphasis mb-3">备份文件可选择加密存储，加密方式可随时更改</p>

            <v-select
              v-model="webdavEncMode"
              :items="[
                { title: '不加密', value: 'none' },
                { title: '密码加密', value: 'password' },
                { title: '对称密钥', value: 'symmetric' },
                { title: '非对称加密', value: 'asymmetric' }
              ]"
              label="加密方式"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="onEncModeChange"
            />

            <!-- 密码加密选项 -->
            <template v-if="webdavEncMode === 'password'">
              <v-text-field
                v-model="webdavEncPassword"
                label="加密密码"
                type="password"
                variant="outlined"
                density="compact"
                hint="用于派生加密密钥，建议 8 位以上"
                persistent-hint
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
              <v-select
                v-model="webdavPasswordAlgo"
                :items="[
                  { title: 'PBKDF2-SHA256（推荐）', value: 'pbkdf2-sha256' },
                  { title: 'PBKDF2-SHA512', value: 'pbkdf2-sha512' },
                  { title: 'Argon2id', value: 'argon2id' }
                ]"
                label="密钥派生算法"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
              <v-text-field
                v-model.number="webdavPbkdf2Iterations"
                label="迭代次数"
                type="number"
                variant="outlined"
                density="compact"
                :min="10000"
                :max="10000000"
                hint="越大越安全，默认为 600000"
                persistent-hint
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
            </template>

            <!-- 对称密钥选项 -->
            <template v-if="webdavEncMode === 'symmetric'">
              <v-textarea
                v-model="webdavSymmetricKey"
                label="对称密钥（Base64）"
                variant="outlined"
                density="compact"
                rows="2"
                hint="输入 Base64 编码的 AES 密钥，或留空自动生成"
                persistent-hint
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
              <v-btn size="small" variant="tonal" class="mt-1" @click="generateSymmetricKey">生成随机密钥</v-btn>
              <v-select
                v-model="webdavSymmetricAlgo"
                :items="[
                  { title: 'AES-256-GCM（推荐）', value: 'aes-256-gcm' },
                  { title: 'AES-256-CBC', value: 'aes-256-cbc' },
                  { title: 'ChaCha20-Poly1305', value: 'chacha20-poly1305' }
                ]"
                label="加密算法"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
            </template>

            <!-- 非对称加密选项 -->
            <template v-if="webdavEncMode === 'asymmetric'">
              <v-textarea
                v-model="webdavPublicKey"
                label="公钥（PEM 格式）"
                variant="outlined"
                density="compact"
                rows="3"
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
              <v-textarea
                v-model="webdavPrivateKey"
                label="私钥（PEM 格式）"
                variant="outlined"
                density="compact"
                rows="3"
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
              <v-btn size="small" variant="tonal" class="mt-1" @click="generateKeyPair">生成密钥对</v-btn>
              <v-select
                v-model="webdavAsymmetricAlgo"
                :items="[
                  { title: 'RSA-2048', value: 'rsa-2048' },
                  { title: 'RSA-4096', value: 'rsa-4096' },
                  { title: 'ECC-P256', value: 'ecc-p256' },
                  { title: 'ECC-P384', value: 'ecc-p384' }
                ]"
                label="非对称算法"
                variant="outlined"
                density="compact"
                hide-details
                class="mt-2"
                @update:model-value="onWebdavConfigChange"
              />
            </template>
          </div>

          <p v-if="webdavLastBackupAt" class="text-caption text-medium-emphasis mt-2">
            上次备份：{{ formatTimestamp(webdavLastBackupAt) }}
          </p>

          <div class="d-flex flex-wrap gap-2 mt-3">
            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              prepend-icon="mdi-connection"
              @click="webdavTestConnection"
              :loading="webdavTesting"
              :disabled="!webdavUrl || !webdavUsername || !webdavPassword"
            >
              测试连接
            </v-btn>
            <v-btn
              color="success"
              variant="outlined"
              size="small"
              prepend-icon="mdi-backup-restore"
              @click="webdavBackupNow"
              :loading="webdavBackingUp"
              :disabled="!webdavConfigured"
            >
              立即备份
            </v-btn>
            <v-btn
              color="warning"
              variant="outlined"
              size="small"
              prepend-icon="mdi-restore"
              @click="webdavRestoreBackup"
              :loading="webdavRestoring"
              :disabled="!webdavConfigured"
            >
              恢复备份
            </v-btn>
          </div>

          <p class="text-caption text-medium-emphasis mt-3">
            <v-icon size="14">mdi-information</v-icon>
            服务器密码用于 WebDAV Basic Auth 认证。可选择密码/对称密钥/非对称加密方式保护备份文件。
          </p>
        </v-card-text>
      </v-card>

      <!-- ==================== 系统 ==================== -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="teal" class="mr-2">mdi-cog-outline</v-icon>
          系统
        </v-card-title>
        <v-card-text>
          <div class="system-grid">
            <v-switch v-model="systemAutoStart" color="primary" label="开机自启" density="compact" hide-details @update:model-value="onAutoStartChange" />
            <v-switch v-model="systemMinimizeToTray" color="primary" label="启动时最小化到托盘" density="compact" hide-details @update:model-value="onMinimizeToTrayChange" />
            <v-switch v-model="systemCloseToTray" color="primary" label="关闭窗口时缩小到托盘" density="compact" hide-details @update:model-value="saveSystemConfig" />
            <v-switch v-model="systemShowNotifications" color="primary" label="启用桌面通知" density="compact" hide-details @update:model-value="saveSystemConfig" />
          </div>

          <v-divider class="my-3" />

          <p class="text-caption font-weight-bold mb-2">启动延迟</p>
          <v-slider v-model="systemStartDelay" :min="0" :max="30" :step="1" thumb-label density="compact" hide-details class="mb-1" @update:model-value="saveSystemConfig">
            <template #append>
              <span class="text-caption text-medium-emphasis" style="min-width:36px">{{ systemStartDelay }}秒</span>
            </template>
          </v-slider>

          <v-divider class="my-3" />

          <p class="text-caption font-weight-bold mb-2">托盘图标行为</p>
          <v-btn-toggle v-model="systemTrayAction" color="primary" density="compact" variant="outlined" divided mandatory class="mb-2" @update:model-value="saveSystemConfig">
            <v-btn :value="'show'" size="small">点击显示</v-btn>
            <v-btn :value="'menu'" size="small">点击菜单</v-btn>
            <v-btn :value="'none'" size="small">无操作</v-btn>
          </v-btn-toggle>

          <p class="text-caption text-medium-emphasis mt-2">
            <v-icon size="14">mdi-information</v-icon>
            系统设置需要 Electron 环境支持。
          </p>
        </v-card-text>
      </v-card>

      <!-- ==================== 关于 ==================== -->
      <v-card>
        <v-card-title class="d-flex align-center text-h6">
          <v-icon color="success" class="mr-2">mdi-information</v-icon>
          关于
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-center gap-3 mb-3">
            <v-avatar size="48" color="#1976D2" rounded>
              <v-icon size="28" color="white">mdi-book-open-page-variant</v-icon>
            </v-avatar>
            <div>
              <p class="text-body-1 font-weight-bold mb-0">X-ReaderPlus v{{ APP_VERSION }}</p>
              <p class="text-caption text-medium-emphasis">完全脱机的现代化多格式阅读器</p>
            </div>
          </div>
          <v-divider class="mb-2" />
          <p class="text-caption text-medium-emphasis mb-1">
            作者：stop666
          </p>
          <p class="text-caption text-medium-emphasis mb-1">
            本程序完全免费，严禁倒卖，已在GitHub开源
          </p>
          <p class="text-caption text-medium-emphasis mb-1">
            <v-icon size="14" class="mr-1">mdi-github</v-icon>
            github.com/stop666two/X-ReaderPlus
          </p>
          <v-divider class="mb-2" />
          <p class="text-caption font-weight-bold mb-1">
            <v-icon size="14" class="mr-1" color="warning">mdi-heart</v-icon>
            捐赠（完全自愿）
          </p>
          <p class="text-caption text-medium-emphasis mb-1">
            USDT（ETH/ERC20 &amp; BSC/BEP20）
          </p>
          <p class="text-caption mb-1" style="font-family: monospace; word-break: break-all;">
            0xbB515f953e16f0a7b51f537BB1DAB6fbB6026533
          </p>
          <v-btn size="x-small" variant="tonal" prepend-icon="mdi-content-copy" @click="copyDonationAddress">
            复制地址
          </v-btn>
          <p class="text-caption text-medium-emphasis">
            支持格式：EPUB, TXT, Markdown, HTML, MOBI, AZW3, FB2, DJVU, DOCX, RTF, ODT, PDF, CBR/CBZ/CBT/CB7
          </p>
        </v-card-text>
      </v-card>
    </div>

    <!-- ==================== Dialogs ==================== -->

    <!-- 关闭 PIN 对话框 -->
    <v-dialog v-model="showRemovePinDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-shield-off</v-icon>
          关闭 PIN 码
        </v-card-title>
        <v-card-text>
          <p class="mb-3">请输入当前 PIN 码以确认关闭</p>
          <v-text-field
            v-model="removePinValue"
            type="password"
            label="当前 PIN 码"
            variant="outlined"
            hide-details
            autofocus
            @keyup.enter="confirmRemovePin"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRemovePinDialog = false">取消</v-btn>
          <v-btn color="error" @click="confirmRemovePin">确认关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 清除全部数据对话框 — 两步确认 -->
    <v-dialog v-model="showClearAll" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center text-error">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          清除全部数据
        </v-card-title>
        <v-card-text>
          <template v-if="!clearAllStep2">
            <p>确定要清除所有数据吗？</p>
            <p class="text-caption text-error mt-1">此操作不可撤销！所有书籍、标注、笔记、书签将被永久删除。</p>
          </template>
          <template v-else>
            <p class="text-error font-weight-bold">再次确认：真的要删除所有数据吗？</p>
            <p class="text-caption mt-1">所有已导入的书籍和阅读记录将永久消失。</p>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearAll = false; clearAllStep2 = false">取消</v-btn>
          <v-btn v-if="!clearAllStep2" color="error" variant="tonal" @click="clearAllStep2 = true">我要清除</v-btn>
          <v-btn v-else color="error" :loading="dataOpInProgress" @click="confirmClearAll">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 清除缓存对话框 -->
    <v-dialog v-model="showCacheClearDialog" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center text-warning">
          <v-icon color="warning" class="mr-2">mdi-delete-sweep</v-icon>
          清除缓存
        </v-card-title>
        <v-card-text>
          <p>确定要清除所有缓存吗？</p>
          <p class="text-caption text-medium-emphasis">将清除缩略图、临时文件和缓存的章节内容。您的书籍数据和阅读进度不会受影响。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCacheClearDialog = false">取消</v-btn>
          <v-btn color="warning" @click="clearCache">确认清除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 导出标注对话框 -->
    <v-dialog v-model="showExportAnnotations" max-width="400">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon color="secondary" class="mr-2">mdi-format-annotation-plus</v-icon>
          导出标注
        </v-card-title>
        <v-card-text>
          <p class="text-caption mb-3">选择导出格式</p>
          <v-radio-group v-model="exportAnnotationFormat" hide-details class="mb-3">
            <v-radio label="Markdown" value="markdown" />
            <v-radio label="CSV" value="csv" />
          </v-radio-group>
          <p class="text-caption text-medium-emphasis">
            <v-icon size="14">mdi-information</v-icon>
            Markdown 按书分组，含颜色标记、原文和笔记；CSV 为表格式数据。
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showExportAnnotations = false">取消</v-btn>
          <v-btn
            color="secondary"
            :loading="exportingAnnotations"
            @click="exportAnnotations"
          >
            导出
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" location="bottom">
      {{ snackbar.text }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">关闭</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useSettingsStore } from '@/stores/settings'
import { useBookshelfStore } from '@/stores/bookshelf'
import { setPin, verifyPin, clearPin, getPinState, timingSafeEqual } from '@/services/pin'
import { db } from '@/services/db'
import { upsertMeta, getAllMetas } from '@/services/metadata'
import { logger } from '@/services/log'
import { FONT_FAMILIES, SECURITY_QUESTIONS, APP_VERSION } from '@/constants'
import { hashPin, generateSalt } from '@/services/crypto'
import { testConnection, uploadFile, downloadFile, encryptPassword, decryptPassword, listBackups, ensureDirectory } from '@/services/webdav'
import { arrayBufferToBase64 } from '@/services/base64'
import type { ThemeMode, BackupData, CustomTheme, Annotation, CustomFont, EncryptionMode, PasswordAlgorithm, SymmetricAlgorithm, AsymmetricAlgorithm } from '@/types'

// ---- API helpers: prefer electronAPI, fall back to Dexie ----
const api = {
  cfg: {
    get: async (k: string): Promise<string | null> => {
      if (window.electronAPI?.config?.get) {
        const v = await window.electronAPI.config.get(k)
        return v ?? null
      }
      const rec = await db.cfg.get(k)
      return rec?.v ?? null
    },
    put: async (k: string, v: string): Promise<void> => {
      if (window.electronAPI?.config?.set) {
        await window.electronAPI.config.set(k, v)
        return
      }
      await db.cfg.put({ k, v })
    },
    getAll: async (): Promise<Record<string, string>> => {
      if (window.electronAPI?.config?.getAll) {
        const rows = await window.electronAPI.config.getAll() as any[]
        const result: Record<string, string> = {}
        rows.forEach((r: any) => { result[r.key ?? r.k] = r.value ?? r.v })
        return result
      }
      const records = await db.cfg.toArray()
      const result: Record<string, string> = {}
      records.forEach((r: any) => { result[r.k] = r.v })
      return result
    },
  },
  meta: {
    toArray: () => (window as any).electronAPI?.meta?.getAll?.() ?? db.meta.toArray(),
  },
  ch: {
    toArray: () => window.electronAPI?.chapters?.getAll?.() ?? db.ch.toArray(),
    get: (bid: string) => window.electronAPI?.chapters?.get?.(bid) ?? db.ch.get(bid),
    put: (bid: string, data: string) => window.electronAPI?.chapters?.set?.(bid, data) ?? db.ch.put({ bid, data }),
  },
  bm: {
    toArray: () => window.electronAPI?.bookmarks?.getAll?.() ?? db.bm.toArray(),
    put: (id: string, data: string) => window.electronAPI?.bookmarks?.insert?.(id, data) ?? db.bm.put({ id, data }),
  },
  ann: {
    toArray: () => window.electronAPI?.annotations?.getAll?.() ?? db.ann.toArray(),
    put: (id: string, data: string) => window.electronAPI?.annotations?.insert?.(id, data) ?? db.ann.put({ id, data }),
  },
  lib: {
    put: async (id: string, data: string) => {
      if (window.electronAPI?.books?.insert) {
        const book = JSON.parse(data)
        await window.electronAPI.books.insert(book)
        return
      }
      return db.lib.put({ id, data })
    },
    bulkGet: async (ids: string[]) => {
      if (window.electronAPI?.books?.getById) {
        const results: any[] = []
        for (const id of ids) {
          const row = await window.electronAPI.books.getById(id)
          if (row) results.push({ id: row.id, data: JSON.stringify(row) })
        }
        return results
      }
      return db.lib.bulkGet(ids)
    },
  },
}

// Helper to parse record data (handles both electronAPI raw values and Dexie records)
function parseRecordData(record: any): any {
  if (!record) return null
  if (typeof record.data === 'string') return JSON.parse(record.data)
  // electronAPI may return raw data (or same shape)
  if (record.data) return record.data
  return record
}

const theme = useThemeStore()
const settings = useSettingsStore()
const bookshelf = useBookshelfStore()

// Reactive shortcuts (passthrough for template binding)
const readingSettings = computed(() => settings.readingSettings)

// ---- Font ----
const FONT_FAMILY_OPTIONS = FONT_FAMILIES
const isCustomFont = ref(false)
const customFontValue = ref('')
const fontFamilySelected = ref(FONT_FAMILIES[0])

function initFontState() {
  const current = settings.readingSettings.fontFamily
  const preset = FONT_FAMILIES.find(f => f.value === current)
  if (preset && preset.value !== '__custom__') {
    fontFamilySelected.value = preset
    isCustomFont.value = false
    customFontValue.value = ''
  } else if (current === '__custom__') {
    isCustomFont.value = true
    fontFamilySelected.value = FONT_FAMILIES.find(f => f.value === '__custom__')!
  } else {
    // It's a custom value that's not __custom__ marker
    isCustomFont.value = true
    customFontValue.value = current
    fontFamilySelected.value = FONT_FAMILIES.find(f => f.value === '__custom__')!
  }
}

function onFontFamilyChange(value: string) {
  if (value === '__custom__') {
    isCustomFont.value = true
    fontFamilySelected.value = FONT_FAMILIES.find(f => f.value === '__custom__')!
    if (customFontValue.value) {
      settings.updateReadingSetting('fontFamily', customFontValue.value)
    }
  } else {
    isCustomFont.value = false
    customFontValue.value = ''
    fontFamilySelected.value = FONT_FAMILIES.find(f => f.value === value)!
    settings.updateReadingSetting('fontFamily', value)
  }
}

function onCustomFontInput(value: string) {
  if (value) {
    settings.updateReadingSetting('fontFamily', value)
  } else {
    // Reset to default font when custom input is cleared
    settings.updateReadingSetting('fontFamily', FONT_FAMILIES[0].value)
  }
}

const fontUploadError = ref('')
const fontInputRef = ref<HTMLInputElement | null>(null)

function triggerFontUpload() {
  fontInputRef.value?.click()
}

async function onFontFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fontUploadError.value = ''

  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const fmtMap: Record<string, CustomFont['format']> = {
    ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2'
  }
  const format = fmtMap[ext]
  if (!format) {
    fontUploadError.value = '不支持的字体格式'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    fontUploadError.value = '字体文件不能超过 10MB'
    return
  }

  try {
    const buf = await file.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    const mime = `font/${ext === 'ttf' ? 'truetype' : ext}`
    const dataUrl = `data:${mime};base64,${base64}`
    const family = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const name = file.name.replace(/\.[^.]+$/, '')

    settings.addCustomFont({ name, family, dataUrl, format })
    settings.updateReadingSetting('fontFamily', `"${family}"`)
    fontFamilySelected.value = FONT_FAMILIES.find(f => f.value === '__custom__')!
    isCustomFont.value = true
    customFontValue.value = `"${family}"`

    // Inject @font-face into document
    injectFontFace(family, dataUrl, format)
  } catch {
    fontUploadError.value = '字体读取失败'
  }
  input.value = ''
}

function onRemoveFont(family: string) {
  settings.removeCustomFont(family)
  const style = document.getElementById(`font-${family}`)
  if (style) style.remove()
  if (settings.readingSettings.fontFamily.includes(family)) {
    settings.updateReadingSetting('fontFamily', FONT_FAMILIES[0].value)
  }
}

function injectFontFace(family: string, dataUrl: string, format: CustomFont['format']) {
  const existing = document.getElementById(`font-${family}`)
  if (existing) existing.remove()
  const style = document.createElement('style')
  style.id = `font-${family}`
  style.textContent = `@font-face{font-family:"${family}";src:url(${dataUrl}) format("${format}");font-display:swap}`
  document.head.appendChild(style)
}

// Inject all stored custom fonts on mount, clean up on unmount
onMounted(() => {
  settings.customFonts.forEach(f => injectFontFace(f.family, f.dataUrl, f.format))
})
onUnmounted(() => {
  settings.customFonts.forEach(f => {
    const el = document.getElementById(`font-${f.family}`)
    if (el) el.remove()
  })
})

// ---- Color pickers ----
const primaryPicker = ref<HTMLInputElement>()
const secondaryPicker = ref<HTMLInputElement>()
const accentPicker = ref<HTMLInputElement>()
const bgPicker = ref<HTMLInputElement>()
const textPicker = ref<HTMLInputElement>()

const pickerRefs: Record<string, any> = {
  primaryPicker: () => primaryPicker,
  secondaryPicker: () => secondaryPicker,
  accentPicker: () => accentPicker,
  bgPicker: () => bgPicker,
  textPicker: () => textPicker
}

function triggerColorPicker(key: string) {
  const refFn = pickerRefs[key]
  if (refFn && refFn().value) {
    refFn().value.click()
  }
}

// ---- Custom Theme Colors (per-theme) ----
const customizeThemeTarget = ref<ThemeMode>('light')
const customPrimaryPicker = ref<HTMLInputElement>()
const customSurfacePicker = ref<HTMLInputElement>()
const customBgPicker = ref<HTMLInputElement>()
const customTextPicker = ref<HTMLInputElement>()

const customPickerRefs: Record<string, any> = {
  customPrimaryPicker: () => customPrimaryPicker,
  customSurfacePicker: () => customSurfacePicker,
  customBgPicker: () => customBgPicker,
  customTextPicker: () => customTextPicker
}

function triggerCustomColorPicker(key: string) {
  const refFn = customPickerRefs[key]
  if (refFn && refFn().value) {
    refFn().value.click()
  }
}

function getCustomThemeColor(themeName: string, colorKey: keyof CustomTheme): string {
  return theme.customThemes[themeName]?.[colorKey] || '#888888'
}

async function onCustomThemeColorChange(key: keyof CustomTheme, value: string) {
  const currentCt = theme.customThemes[customizeThemeTarget.value]
  if (!currentCt) return
  const updated = { ...currentCt, [key]: value }
  await theme.setCustomTheme(customizeThemeTarget.value, updated)
}

async function resetCustomThemeColors() {
  await theme.resetCustomTheme(customizeThemeTarget.value)
  showSnackbar(`${themeNameLabel(customizeThemeTarget.value)} 主题颜色已恢复默认`, 'warning')
}

async function resetAllCustomThemeColors() {
  await theme.resetAllCustomThemes()
  showSnackbar('全部主题颜色已恢复默认', 'warning')
}

function themeNameLabel(name: string): string {
  return name === 'light' ? '明亮' : name === 'dark' ? '暗黑' : '护眼'
}

// ---- PIN ----
const pinIsSet = ref(false)
const newPin = ref('')
const confirmPin = ref('')
const showNewPin = ref(false)
const pinError = ref(false)
const pinErrorMessage = ref('')
const pinLoading = ref(false)
const pinMessage = ref('')
const pinMessageType = ref<'success' | 'error' | 'warning' | 'info'>('info')
const showRemovePinDialog = ref(false)
const removePinValue = ref('')
const showChangePin = ref(false)
const currentPinForChange = ref('')
const newPinForChange = ref('')
const confirmNewPinForChange = ref('')

async function checkPinStatus() {
  const state = await getPinState()
  pinIsSet.value = state?.isSet ?? false
}

async function setNewPin() {
  if (newPin.value.length < 4) {
    pinError.value = true
    pinErrorMessage.value = 'PIN 码至少 4 位'
    return
  }
  if (newPin.value !== confirmPin.value) {
    pinError.value = true
    pinErrorMessage.value = '两次输入不一致'
    return
  }
  pinLoading.value = true
  pinError.value = false
  try {
    await setPin(newPin.value)
    pinIsSet.value = true
    newPin.value = ''
    confirmPin.value = ''
    showSnackbar('PIN 码设置成功', 'success')
  } catch (e: any) {
    pinError.value = true
    pinErrorMessage.value = e.message || '设置失败'
  } finally {
    pinLoading.value = false
  }
}

async function confirmRemovePin() {
  const valid = await verifyPin(removePinValue.value)
  if (valid) {
    await clearPin()
    pinIsSet.value = false
    showRemovePinDialog.value = false
    removePinValue.value = ''
    showSnackbar('PIN 码已关闭', 'warning')
  } else {
    pinMessage.value = 'PIN 码验证失败'
    pinMessageType.value = 'error'
  }
}

async function changePin() {
  if (newPinForChange.value.length < 4) {
    showSnackbar('新 PIN 码至少 4 位', 'error')
    return
  }
  if (newPinForChange.value !== confirmNewPinForChange.value) {
    showSnackbar('两次输入不一致', 'error')
    return
  }
  pinLoading.value = true
  try {
    const valid = await verifyPin(currentPinForChange.value)
    if (!valid) {
      showSnackbar('当前 PIN 码错误', 'error')
      return
    }
    await setPin(newPinForChange.value)
    currentPinForChange.value = ''
    newPinForChange.value = ''
    confirmNewPinForChange.value = ''
    showChangePin.value = false
    showSnackbar('PIN 码修改成功', 'success')
  } catch (e: any) {
    showSnackbar(e.message || '修改失败', 'error')
  } finally {
    pinLoading.value = false
  }
}

// ---- Security Question ----
const securityQuestionSelected = ref(SECURITY_QUESTIONS[0])
const customSecurityQuestion = ref('')
const securityAnswer = ref('')
const showSecurityAnswer = ref(false)
const secSaving = ref(false)
const savedSecurityQuestion = ref('')
const showPinReset = ref(false)
const pinResetAnswer = ref('')
const pinResetLoading = ref(false)

const canSaveSecurity = computed(() => {
  const q = securityQuestionSelected.value
  if (q === '自定义问题') return !!customSecurityQuestion.value && !!securityAnswer.value
  return !!q && !!securityAnswer.value
})

async function loadSecurityQuestion() {
  try {
    const v = await api.cfg.get('securityQuestion')
    if (v) {
      savedSecurityQuestion.value = v
    }
  } catch (e) { logger.error('加载安全问题失败', e) }
}

async function saveSecurityQuestion() {
  secSaving.value = true
  try {
    const question = securityQuestionSelected.value === '自定义问题'
      ? customSecurityQuestion.value
      : securityQuestionSelected.value

    // Hash answer before storing
    const salt = generateSalt()
    const answerHash = await hashPin(securityAnswer.value, salt)
    const saltB64 = btoa(String.fromCharCode(...salt))

    await api.cfg.put('securityQuestion', question)
    await api.cfg.put('securityAnswerHash', answerHash)
    await api.cfg.put('securityAnswerSalt', saltB64)
    savedSecurityQuestion.value = question
    securityAnswer.value = ''
    showSnackbar('安全问题已保存', 'success')
  } catch (e: any) {
    showSnackbar('保存失败: ' + (e.message || ''), 'error')
  } finally {
    secSaving.value = false
  }
}

async function resetPinBySecurity() {
  pinResetLoading.value = true
  try {
    const hashV = await api.cfg.get('securityAnswerHash')
    const saltV = await api.cfg.get('securityAnswerSalt')
    if (!hashV || !saltV) {
      showSnackbar('未设置安全问题', 'error')
      return
    }
    const salt = new Uint8Array(atob(saltV).split('').map(c => c.charCodeAt(0)))
    const hash = await hashPin(pinResetAnswer.value, salt)
    if (!timingSafeEqual(hash, hashV)) {
      showSnackbar('答案不正确', 'error')
      return
    }
    // Answer correct — clear PIN
    await clearPin()
    pinIsSet.value = false
    showPinReset.value = false
    pinResetAnswer.value = ''
    showSnackbar('PIN 码已重置，请重新设置', 'success')
  } catch (e: any) {
    showSnackbar('重置失败', 'error')
  } finally {
    pinResetLoading.value = false
  }
}

// ---- PIN Escalation ----
const pinEscalation = ref({ firstAttempts: 5, firstLockDuration: 30, secondAttempts: 10, secondLockDuration: 300 })

async function loadPinEscalation() {
  const { getEscalationSettings } = await import('@/services/pin')
  try {
    const esc = await getEscalationSettings()
    Object.assign(pinEscalation.value, esc)
  } catch (e) { logger.error('加载 PIN 升级设置失败', e) }
}

async function savePinEscalation() {
  const { saveEscalationSettings } = await import('@/services/pin')
  try {
    await saveEscalationSettings({ ...pinEscalation.value })
  } catch (e) { logger.error('保存 PIN 升级设置失败', e) }
}

// ---- Shortcuts ----
const shortcuts = ref<Record<string, string>>({ bossKey: 'Ctrl+B', toggleTheme: 'Ctrl+T', commandPalette: 'Ctrl+K' })

const globalShortcutDefs = [
  { key: 'bossKey', label: '老板键', desc: '隐藏/显示窗口' },
  { key: 'toggleTheme', label: '切换主题', desc: '明亮/暗黑/护眼' },
  { key: 'commandPalette', label: '命令面板', desc: '搜索命令' }
]

const readingShortcutDefs = [
  { key: 'prevChapter', label: '上一章' },
  { key: 'nextChapter', label: '下一章' },
  { key: 'scrollUp', label: '滚动上' },
  { key: 'scrollDown', label: '滚动下' },
  { key: 'pageUp', label: '上一页' },
  { key: 'pageDown', label: '下一页' },
  { key: 'search', label: '搜索' },
  { key: 'chapterStart', label: '章节开头' },
  { key: 'chapterEnd', label: '章节末尾' }
]

// ---- Shortcut Conflict Detection ----
const shortcutConflicts = computed(() => {
  const allBindings = new Map<string, string[]>()

  for (const def of globalShortcutDefs) {
    const binding = shortcuts.value[def.key]
    if (binding) {
      if (!allBindings.has(binding)) allBindings.set(binding, [])
      allBindings.get(binding)!.push(def.label)
    }
  }

  for (const def of readingShortcutDefs) {
    const binding = settings.readingShortcuts[def.key]
    if (binding) {
      if (!allBindings.has(binding)) allBindings.set(binding, [])
      allBindings.get(binding)!.push(def.label)
    }
  }

  const conflicts: { binding: string; names: string[] }[] = []
  for (const [binding, names] of allBindings) {
    if (names.length > 1) {
      conflicts.push({ binding, names })
    }
  }
  return conflicts
})

function isBindingConflicting(binding: string | undefined): boolean {
  if (!binding) return false
  return shortcutConflicts.value.some(c => c.binding === binding)
}

// Key capture
const capturingShortcut = ref('')

function startCapture(field: string) {
  capturingShortcut.value = field
}

function stopCapture() {
  capturingShortcut.value = ''
}

function captureShortcut(field: string, e: KeyboardEvent) {
  e.preventDefault()
  // Ignore standalone modifier keys
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
  
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')
  
  const keyMap: Record<string, string> = {
    'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'PageUp': 'PageUp', 'PageDown': 'PageDown',
    'Home': 'Home', 'End': 'End',
    ' ': 'Space', 'Escape': 'Esc', 'Tab': 'Tab',
    'Delete': 'Del', 'Insert': 'Ins',
    'Backspace': 'Backspace', 'Enter': 'Enter'
  }
  const keyName = keyMap[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  parts.push(keyName)
  
  const shortcut = parts.join('+')
  
  // Check if it's a reading shortcut or global shortcut
  const readingKeys = ['prevChapter', 'nextChapter', 'scrollUp', 'scrollDown', 'pageUp', 'pageDown', 'search', 'chapterStart', 'chapterEnd']
  if (readingKeys.includes(field)) {
    (settings.readingShortcuts as any)[field] = shortcut
    saveReadingShortcuts()
  } else {
    shortcuts.value[field] = shortcut
    saveShortcut(field, shortcut)
  }
  
  capturingShortcut.value = ''
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

async function loadShortcuts() {
  if (window.electronAPI) {
    const saved = await window.electronAPI.getShortcuts()
    if (saved) Object.assign(shortcuts.value, saved)
  }
}

async function saveShortcut(key: string, value: string) {
  if (window.electronAPI) {
    await window.electronAPI.setShortcut(key, value)
  }
}

async function saveReadingShortcuts() {
  await settings.save()
}

async function resetAllShortcuts() {
  shortcuts.value.bossKey = 'Ctrl+B'
  shortcuts.value.toggleTheme = 'Ctrl+T'
  shortcuts.value.commandPalette = 'Ctrl+K'
  await saveShortcut('bossKey', 'Ctrl+B')
  await saveShortcut('toggleTheme', 'Ctrl+T')
  await saveShortcut('commandPalette', 'Ctrl+K')
  settings.resetReadingShortcuts()
  showSnackbar('所有快捷键已重置', 'success')
}

// ---- Data Management ----
const exporting = ref(false)
const importing = ref(false)
const refreshing = ref(false)
const showClearAll = ref(false)
const clearAllStep2 = ref(false)
const dataOpInProgress = ref(false)
const dataOpProgress = ref(0)
const dataOpIndeterminate = ref(false)

// ---- Annotation Export ----
const showExportAnnotations = ref(false)
const exportAnnotationFormat = ref<'markdown' | 'csv'>('markdown')
const exportingAnnotations = ref(false)
const dataOpLabel = ref('')

// ---- Page Sizes ----
const PAGE_SIZES_KEY = 'pageSizes'
const pageSizes = reactive({
  bookshelf: 30,
  notes: 20,
  history: 20,
  trash: 20
})

async function loadPageSizes() {
  try {
    const v = await api.cfg.get(PAGE_SIZES_KEY)
    if (v) {
      const saved = JSON.parse(v)
      if (saved.bookshelf) pageSizes.bookshelf = saved.bookshelf
      if (saved.notes) pageSizes.notes = saved.notes
      if (saved.history) pageSizes.history = saved.history
      if (saved.trash) pageSizes.trash = saved.trash
    }
  } catch { /* localStorage parse failed, use defaults */ }
}

async function savePageSizes() {
  await api.cfg.put(PAGE_SIZES_KEY, JSON.stringify({ ...pageSizes }))
}

const DONATION_ADDRESS = '0xbB515f953e16f0a7b51f537BB1DAB6fbB6026533'
async function copyDonationAddress() {
  try {
    await navigator.clipboard.writeText(DONATION_ADDRESS)
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = DONATION_ADDRESS; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

async function exportData() {
  exporting.value = true
  dataOpInProgress.value = true
  dataOpIndeterminate.value = true
  dataOpLabel.value = '正在导出...'
  try {
    const [metaRecords, chRecords, bmRecords, annRecords, cfgRecords] = await Promise.all([
      api.meta.toArray(),
      api.ch.toArray(),
      api.bm.toArray(),
      api.ann.toArray(),
      db.cfg.toArray()
    ])

    // Merge meta + lib extras into full Book objects for export
    const allIds = metaRecords.map((r: any) => (typeof r.data === 'string' ? JSON.parse(r.data) : r).bid)
    const libExtrasRecs = await api.lib.bulkGet(allIds)
    const libExtrasMap = new Map<string, any>()
    for (const rec of libExtrasRecs) {
      if (rec) {
        try { libExtrasMap.set(rec.id, typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data || rec) } catch { /* corrupt backup entry, skip */ }
      }
    }
    const exportBooks = metaRecords.map((r: any) => {
      const m = typeof r.data === 'string' ? JSON.parse(r.data) : r.data || r
      const extras = libExtrasMap.get(m.bid) || {}
      return {
        id: m.bid, title: m.title, author: m.author, cover: m.cover,
        format: m.format, size: m.size, chapterCount: m.chapterCount,
        tags: m.tags, rating: m.rating, contentHash: m.contentHash,
        path: m.path, libraryId: m.libraryId, addedAt: m.addedAt,
        lastReadAt: m.lastReadAt, progress: m.progress, wordCount: m.wordCount,
        review: extras.review || '',
        chapterIndex: extras.chapterIndex || 0,
        chapterProgress: extras.chapterProgress || 0,
        totalReadingTime: extras.totalReadingTime || 0
      }
    })

    const backup: BackupData = {
      version: APP_VERSION,
      exportedAt: Date.now(),
      books: exportBooks,
      chapters: {},
      bookmarks: bmRecords.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r),
      annotations: annRecords.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r),
      settings: {},
      pinState: null,
      libraries: []
    }

    chRecords.forEach((r: any) => {
      backup.chapters[r.bid] = typeof r.data === 'string' ? JSON.parse(r.data) : r
    })

    cfgRecords.forEach((r: any) => {
      if (r.k !== 'encryptionKey' && r.k !== 'pinState' && r.k !== 'securityAnswerHash' && r.k !== 'securityAnswerSalt') {
        backup.settings[r.k] = r.v
      }
    })

    const state = await getPinState()
    if (state) {
      const ek = await api.cfg.get('encryptionKey')
      if (ek) state.encryptionKey = ek
    }
    backup.pinState = state

    const json = JSON.stringify(backup, null, 2)

    if (window.electronAPI) {
      const result = await window.electronAPI.saveFile({
        defaultPath: `x-reader-plus-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (!result.canceled && result.filePath) {
        const encoder = new TextEncoder()
        const data = encoder.encode(json).buffer
        await window.electronAPI.writeFile(result.filePath, data)
        showSnackbar('数据导出成功', 'success')
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `x-reader-plus-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      showSnackbar('数据导出成功', 'success')
    }
  } catch (e: any) {
    showSnackbar('导出失败: ' + (e.message || ''), 'error')
  } finally {
    exporting.value = false
    dataOpInProgress.value = false
  }
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    importing.value = true
    dataOpInProgress.value = true
    dataOpIndeterminate.value = true
    dataOpLabel.value = '正在导入...'
    try {
      const text = await file.text()
      const data: BackupData = JSON.parse(text)
      if (!data.version) throw new Error('无效的备份文件')

      const total = data.books.length + Object.keys(data.chapters).length + data.bookmarks.length + data.annotations.length + Object.keys(data.settings).length
      let done = 0

      for (const book of data.books) {
        // Write lib extras only
        await api.lib.put(book.id, JSON.stringify({ review: book.review || '', chapterIndex: book.chapterIndex || 0, chapterProgress: book.chapterProgress || 0, totalReadingTime: book.totalReadingTime || 0 }))
        // Write meta for display fields
        await upsertMeta(book)
        done++
        dataOpProgress.value = Math.round((done / total) * 100)
      }
      for (const [bid, chapters] of Object.entries(data.chapters)) {
        await api.ch.put(bid, JSON.stringify(chapters))
        done++
        dataOpProgress.value = Math.round((done / total) * 100)
      }
      for (const bm of data.bookmarks) {
        await api.bm.put(bm.id, JSON.stringify(bm))
        done++
        dataOpProgress.value = Math.round((done / total) * 100)
      }
      for (const ann of data.annotations) {
        await api.ann.put(ann.id, JSON.stringify(ann))
        done++
        dataOpProgress.value = Math.round((done / total) * 100)
      }
      for (const [key, value] of Object.entries(data.settings)) {
        await api.cfg.put(key, String(value))
        done++
        dataOpProgress.value = Math.round((done / total) * 100)
      }
      if (data.pinState) {
        const { encryptionKey, ...pinStateOnly } = data.pinState as any
        await api.cfg.put('pinState', JSON.stringify(pinStateOnly))
        if (encryptionKey) {
          await api.cfg.put('encryptionKey', encryptionKey)
        }
      }

      await bookshelf.loadBooks()
      await settings.load()
      await checkPinStatus()
      await loadSecurityQuestion()
      dataOpIndeterminate.value = false
      dataOpProgress.value = 100
      showSnackbar('数据恢复成功！', 'success')
    } catch (e: any) {
      showSnackbar('导入失败: ' + (e.message || ''), 'error')
    } finally {
      importing.value = false
      dataOpInProgress.value = false
      dataOpProgress.value = 0
    }
  }
  input.click()
}

async function refreshMetadata() {
  refreshing.value = true
  dataOpInProgress.value = true
  dataOpIndeterminate.value = false
  dataOpLabel.value = '正在刷新元数据...'
  let done = 0
  const total = bookshelf.books.length
  for (const book of bookshelf.books) {
    try {
      const chRecord = await api.ch.get(book.id)
      if (chRecord) {
        const chData = typeof chRecord === 'string' ? chRecord : (chRecord as any).data
        const chapters = JSON.parse(chData)
        const wordCount = chapters.reduce((sum: number, ch: any) => {
          const stripped = ch.content.replace(/<[^>]+>/g, '')
          const chinese = (stripped.match(/[\u4e00-\u9fff]/g) || []).length
          const words = stripped.split(/\s+/).filter((w: string) => w.length > 0).length
          return sum + chinese + words
        }, 0)
        await bookshelf.updateBook(book.id, { wordCount })
      }
    } catch (e) { logger.error('元数据刷新跳过', e) }
    done++
    dataOpProgress.value = total > 0 ? Math.round((done / total) * 100) : 100
  }
  await bookshelf.loadBooks()
  showSnackbar('元数据刷新完成', 'success')
  refreshing.value = false
  dataOpInProgress.value = false
  dataOpProgress.value = 0
}

async function confirmClearAll() {
  showClearAll.value = false
  clearAllStep2.value = false
  if (!window.electronAPI) return
  dataOpInProgress.value = true
  dataOpProgress.value = 0
  dataOpLabel.value = '正在清除所有数据...'
  try {
    await new Promise(r => setTimeout(r, 100))
    dataOpProgress.value = 30
    await window.electronAPI.clearAll()
    dataOpProgress.value = 70
    // Reload bookshelf store so the sample book appears
    await bookshelf.loadBooks()
    dataOpProgress.value = 90
    await new Promise(r => setTimeout(r, 200))
    dataOpProgress.value = 100
    window.location.hash = '#/'
  } catch (e: any) {
    showSnackbar('清除失败: ' + (e.message || '未知错误'), 'error')
  } finally {
    dataOpInProgress.value = false
    dataOpProgress.value = 0
    dataOpLabel.value = ''
  }
}

async function cleanupOrphanedData() {
  dataOpInProgress.value = true
  dataOpIndeterminate.value = true
  dataOpLabel.value = '正在清理失效数据...'
  try {
    const r = await window.electronAPI.cleanupOrphans()
    if (r && typeof r === 'object') {
      showSnackbar(`清理完成: ${r.bookmarks || 0} 条书签, ${r.annotations || 0} 条标注, ${r.history || 0} 条历史记录`, 'success')
    } else {
      showSnackbar('失效数据清理完成', 'success')
    }
  } catch (e: any) {
    showSnackbar('清理失败: ' + (e.message || '未知错误'), 'error')
  } finally {
    dataOpInProgress.value = false
    dataOpIndeterminate.value = false
    dataOpLabel.value = ''
  }
}

// ---- Annotation Export ----
async function exportAnnotations() {
  exportingAnnotations.value = true
  try {
    const annRecords = await api.ann.toArray()
    const annotations: Annotation[] = annRecords.map((r: any) => (typeof r.data === 'string' ? JSON.parse(r.data) : r)).filter((a: Annotation) => !a.deleted)

    if (annotations.length === 0) {
      showSnackbar('没有可导出的标注', 'warning')
      return
    }

    // Load all books for lookup — use meta table (display fields)
    const metaRecords = await api.meta.toArray()
    const bookMap = new Map<string, string>()
    metaRecords.forEach((r: any) => {
      try {
        const m = typeof r.data === 'string' ? JSON.parse(r.data) : r
        bookMap.set(m.bid, m.title || '未知书名')
      } catch { /* corrupt metadata entry, skip */ }
    })

    // Group annotations by bookId
    const grouped = new Map<string, Annotation[]>()
    annotations.forEach(a => {
      const list = grouped.get(a.bookId) || []
      list.push(a)
      grouped.set(a.bookId, list)
    })

    // Load chapters for all relevant books
    const chMap = new Map<string, Map<number, string>>()
    for (const bid of grouped.keys()) {
      const chRecord = await api.ch.get(bid)
      if (chRecord) {
        try {
          const chData = typeof chRecord === 'string' ? chRecord : (chRecord as any).data
          const chapters = JSON.parse(chData) as { title: string }[]
          const titleMap = new Map<number, string>()
          chapters.forEach((ch, i) => titleMap.set(i, ch.title || `第 ${i + 1} 章`))
          chMap.set(bid, titleMap)
        } catch { /* corrupt chapter data, skip */ }
      }
    }

    let content = ''
    let defaultName = ''

    if (exportAnnotationFormat.value === 'markdown') {
      // Markdown format: grouped by book
      const lines: string[] = ['# 标注导出', '', `导出日期：${new Date().toLocaleString('zh-CN')}`, `标注总数：${annotations.length} 条`, '']
      for (const [bid, anns] of grouped) {
        const bookTitle = bookMap.get(bid) || '未知书名'
        lines.push(`## ${bookTitle}`, '')
        for (const a of anns) {
          const chapterTitles = chMap.get(bid)
          const chapterTitle = chapterTitles?.get(a.chapterIndex) || `第 ${a.chapterIndex + 1} 章`
          const colorLabel = a.color || 'yellow'
          const typeLabel = a.type === 'note' ? '📝 笔记' : '🖍 标注'
          lines.push(`### ${typeLabel} · ${colorLabel} · ${chapterTitle}`, '')
          if (a.text) {
            lines.push(`**原文：** ${escapeMarkdown(a.text)}`, '')
          }
          if (a.note) {
            lines.push(`**笔记：** ${escapeMarkdown(a.note)}`, '')
          }
          if (a.tags && a.tags.length > 0) {
            lines.push(`**标签：** ${a.tags.map(t => `\`${t}\``).join(' ')}`, '')
          }
          lines.push('---', '')
        }
      }
      content = lines.join('\n')
      defaultName = `x-reader-plus-annotations-${new Date().toISOString().slice(0, 10)}.md`
    } else {
      // CSV format
      const rows: string[] = ['书名|章节|颜色|标注文本|笔记|日期']
      for (const [bid, anns] of grouped) {
        const bookTitle = bookMap.get(bid) || '未知书名'
        const chapterTitles = chMap.get(bid)
        for (const a of anns) {
          const chapterTitle = chapterTitles?.get(a.chapterIndex) || `第 ${a.chapterIndex + 1} 章`
          const date = new Date(a.createdAt).toLocaleString('zh-CN')
          const csvBookTitle = csvEscape(bookTitle)
          const csvChapter = csvEscape(chapterTitle)
          const csvColor = csvEscape(a.color)
          const csvText = csvEscape(a.text || '')
          const csvNote = csvEscape(a.note || '')
          const csvDate = csvEscape(date)
          rows.push(`${csvBookTitle}|${csvChapter}|${csvColor}|${csvText}|${csvNote}|${csvDate}`)
        }
      }
      content = '\uFEFF' + rows.join('\n')
      defaultName = `x-reader-plus-annotations-${new Date().toISOString().slice(0, 10)}.csv`
    }

    // Save file
    if (window.electronAPI) {
      const ext = exportAnnotationFormat.value === 'markdown' ? 'md' : 'csv'
      const result = await window.electronAPI.saveFile({
        defaultPath: `x-reader-plus-annotations-${new Date().toISOString().slice(0, 10)}.${ext}`,
        filters: exportAnnotationFormat.value === 'markdown'
          ? [{ name: 'Markdown', extensions: ['md'] }]
          : [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (!result.canceled && result.filePath) {
        const encoder = new TextEncoder()
        const data = encoder.encode(content).buffer
        await window.electronAPI.writeFile(result.filePath, data)
        showExportAnnotations.value = false
        showSnackbar('标注导出成功', 'success')
      }
    } else {
      const mime = exportAnnotationFormat.value === 'markdown' ? 'text/markdown' : 'text/csv'
      const blob = new Blob([content], { type: `${mime};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
      showExportAnnotations.value = false
      showSnackbar('标注导出成功', 'success')
    }
  } catch (e: any) {
    showSnackbar('导出标注失败: ' + (e.message || ''), 'error')
  } finally {
    exportingAnnotations.value = false
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[*_`#{}[\]()<>!|~-]/g, '\\$&')
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes('|') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ---- WebDAV Backup ----
const WEBDAV_INTERVAL_OPTIONS = [
  { label: '关闭', value: 'off' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' }
]

const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const webdavShowPwd = ref(false)
const webdavEncPassword = ref('')
const webdavEncShowPwd = ref(false)
const webdavAutoBackupInterval = ref('off')
const webdavLastBackupAt = ref(0)
const webdavMessage = ref('')
const webdavMessageType = ref<'success' | 'error' | 'warning' | 'info'>('info')
const webdavTesting = ref(false)
const webdavBackingUp = ref(false)
const webdavRestoring = ref(false)

const webdavEncMode = ref<EncryptionMode>('none')
const webdavPasswordAlgo = ref<PasswordAlgorithm>('pbkdf2-sha256')
const webdavSymmetricAlgo = ref<SymmetricAlgorithm>('aes-256-gcm')
const webdavAsymmetricAlgo = ref<AsymmetricAlgorithm>('rsa-2048')
const webdavPbkdf2Iterations = ref(600000)
const webdavSymmetricKey = ref('')
const webdavPublicKey = ref('')
const webdavPrivateKey = ref('')

const webdavConfigured = computed(() => !!webdavUrl.value && !!webdavUsername.value && !!webdavPassword.value)

async function loadWebdavConfig() {
  try {
    const v = await api.cfg.get('webdavConfig')
    if (v) {
      const cfg = JSON.parse(v)
      webdavUrl.value = cfg.url || ''
      webdavUsername.value = cfg.username || ''
      webdavAutoBackupInterval.value = cfg.autoBackupInterval || 'off'
      webdavLastBackupAt.value = cfg.lastBackupAt || 0
      if (cfg.passwordIv && cfg.passwordCipher) {
        try {
          webdavPassword.value = await decryptPassword(cfg.passwordIv, cfg.passwordCipher)
        } catch (e) {
          logger.warn('WebDAV 密码解密失败，请重新输入', e)
          webdavPassword.value = ''
        }
      }
      if (cfg.encPasswordIv && cfg.encPasswordCipher) {
        try {
          webdavEncPassword.value = await decryptPassword(cfg.encPasswordIv, cfg.encPasswordCipher)
        } catch (e) {
          logger.warn('WebDAV 加密密码解密失败', e)
          webdavEncPassword.value = ''
        }
      }
      const encConfig = cfg.encConfig || {}
      webdavEncMode.value = encConfig.mode || 'none'
      webdavPasswordAlgo.value = encConfig.passwordAlgorithm || 'pbkdf2-sha256'
      webdavSymmetricAlgo.value = encConfig.symmetricAlgorithm || 'aes-256-gcm'
      webdavAsymmetricAlgo.value = encConfig.asymmetricAlgorithm || 'rsa-2048'
      webdavPbkdf2Iterations.value = encConfig.pbkdf2Iterations || 600000
    }
  } catch (e) { logger.error('加载 WebDAV 配置失败', e) }
}

async function onWebdavConfigChange() {
  try {
    const passwordEncrypted = webdavPassword.value
      ? await encryptPassword(webdavPassword.value)
      : null
    const encPasswordEncrypted = webdavEncPassword.value
      ? await encryptPassword(webdavEncPassword.value)
      : null
    const cfg = {
      url: webdavUrl.value,
      username: webdavUsername.value,
      passwordIv: passwordEncrypted?.iv || '',
      passwordCipher: passwordEncrypted?.ciphertext || '',
      encPasswordIv: encPasswordEncrypted?.iv || '',
      encPasswordCipher: encPasswordEncrypted?.ciphertext || '',
      autoBackupInterval: webdavAutoBackupInterval.value,
      lastBackupAt: webdavLastBackupAt.value,
      encConfig: {
        mode: webdavEncMode.value,
        passwordAlgorithm: webdavPasswordAlgo.value,
        symmetricAlgorithm: webdavSymmetricAlgo.value,
        asymmetricAlgorithm: webdavAsymmetricAlgo.value,
        pbkdf2Iterations: webdavPbkdf2Iterations.value,
      }
    }
    await api.cfg.put('webdavConfig', JSON.stringify(cfg))
  } catch (e) {
    logger.error('保存 WebDAV 配置失败', e)
  }
}

function onEncModeChange() {
  // 切换加密方式时自动保存配置
  onWebdavConfigChange()
}

function generateSymmetricKey() {
  const key = crypto.getRandomValues(new Uint8Array(32))
  webdavSymmetricKey.value = btoa(String.fromCharCode(...key))
  onWebdavConfigChange()
}

async function generateKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt']
    )
    const pubKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    const privKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    webdavPublicKey.value = btoa(String.fromCharCode(...new Uint8Array(pubKey)))
    webdavPrivateKey.value = btoa(String.fromCharCode(...new Uint8Array(privKey)))
    onWebdavConfigChange()
  } catch (e) {
    console.warn('密钥对生成失败', e)
  }
}

async function webdavTestConnection() {
  webdavTesting.value = true
  webdavMessage.value = ''
  try {
    const result = await testConnection(webdavUrl.value, webdavUsername.value, webdavPassword.value)
    if (result.success) {
      webdavMessage.value = '连接成功！WebDAV 服务器可访问。'
      webdavMessageType.value = 'success'
    } else {
      webdavMessage.value = result.message
      webdavMessageType.value = 'error'
    }
  } catch (e: any) {
    webdavMessage.value = '连接测试失败：' + (e.message || '未知错误')
    webdavMessageType.value = 'error'
  } finally {
    webdavTesting.value = false
  }
}

async function webdavBackupNow() {
  webdavBackingUp.value = true
  webdavMessage.value = ''
  try {
    // Build backup data
    const [metaRecords, chRecords, bmRecords, annRecords, cfgRecords] = await Promise.all([
      api.meta.toArray(),
      api.ch.toArray(),
      api.bm.toArray(),
      api.ann.toArray(),
      db.cfg.toArray()
    ])

    // Merge meta + lib extras into full Book objects
    const allIds = metaRecords.map((r: any) => {
      const m = typeof r.data === 'string' ? JSON.parse(r.data) : r
      return m.bid
    })
    const libExtrasRecs = await api.lib.bulkGet(allIds)
    const libExtrasMap = new Map<string, any>()
    for (const rec of libExtrasRecs) {
      if (rec) {
        try { libExtrasMap.set(rec.id, typeof rec.data === 'string' ? JSON.parse(rec.data) : rec.data || rec) } catch { /* corrupt backup entry, skip */ }
      }
    }
    const webdavBooks = metaRecords.map((r: any) => {
      const m = typeof r.data === 'string' ? JSON.parse(r.data) : r
      const extras = libExtrasMap.get(m.bid) || {}
      return {
        id: m.bid, title: m.title, author: m.author, cover: m.cover,
        format: m.format, size: m.size, chapterCount: m.chapterCount,
        tags: m.tags, rating: m.rating, contentHash: m.contentHash,
        path: m.path, libraryId: m.libraryId, addedAt: m.addedAt,
        lastReadAt: m.lastReadAt, progress: m.progress, wordCount: m.wordCount,
        review: extras.review || '',
        chapterIndex: extras.chapterIndex || 0,
        chapterProgress: extras.chapterProgress || 0,
        totalReadingTime: extras.totalReadingTime || 0
      }
    })

    const backup: BackupData = {
      version: APP_VERSION,
      exportedAt: Date.now(),
      books: webdavBooks,
      chapters: {},
      bookmarks: bmRecords.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r),
      annotations: annRecords.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r),
      settings: {},
      pinState: null,
      libraries: []
    }

    chRecords.forEach((r: any) => {
      backup.chapters[r.bid] = typeof r.data === 'string' ? JSON.parse(r.data) : r
    })

    cfgRecords.forEach((r: any) => {
      if (r.k !== 'encryptionKey' && r.k !== 'pinState' && r.k !== 'securityAnswerHash' && r.k !== 'securityAnswerSalt' && r.k !== 'webdavEncKey') {
        backup.settings[r.k] = r.v
      }
    })

    const state = await getPinState()
    if (state) {
      const ek = await api.cfg.get('encryptionKey')
      if (ek) state.encryptionKey = ek
    }
    backup.pinState = state

    const json = JSON.stringify(backup, null, 2)
    const encoder = new TextEncoder()
    const data = encoder.encode(json).buffer

    const fileName = `x-reader-plus-backup-${new Date().toISOString().slice(0, 10)}.json`

    // Ensure backup directory exists
    await ensureDirectory(webdavUrl.value, webdavUsername.value, webdavPassword.value, '')

    await uploadFile(webdavUrl.value, webdavUsername.value, webdavPassword.value, fileName, data)

    webdavLastBackupAt.value = Date.now()
    await onWebdavConfigChange()

    webdavMessage.value = `备份成功 (${fileName})`
    webdavMessageType.value = 'success'
  } catch (e: any) {
    webdavMessage.value = '备份失败：' + (e.message || '未知错误')
    webdavMessageType.value = 'error'
  } finally {
    webdavBackingUp.value = false
  }
}

async function webdavRestoreBackup() {
  webdavRestoring.value = true
  webdavMessage.value = ''
  try {
    const backupList = await listBackups(webdavUrl.value, webdavUsername.value, webdavPassword.value)

    if (backupList.length === 0) {
      webdavMessage.value = '服务器上没有找到备份文件'
      webdavMessageType.value = 'warning'
      return
    }

    // Sort by name descending to get newest
    backupList.sort((a, b) => b.localeCompare(a))
    const latest = backupList[0]

    const data = await downloadFile(webdavUrl.value, webdavUsername.value, webdavPassword.value, latest)
    const decoder = new TextDecoder()
    const json = decoder.decode(data)
    const backup: BackupData = JSON.parse(json)
    if (!backup.version) throw new Error('无效的备份文件')

    const total = backup.books.length + Object.keys(backup.chapters).length + backup.bookmarks.length + backup.annotations.length + Object.keys(backup.settings).length
    let done = 0

    for (const book of backup.books) {
      // Write lib extras only
      await api.lib.put(book.id, JSON.stringify({ review: book.review || '', chapterIndex: book.chapterIndex || 0, chapterProgress: book.chapterProgress || 0, totalReadingTime: book.totalReadingTime || 0 }))
      await upsertMeta(book)
      done++
      dataOpProgress.value = Math.round((done / Math.max(total, 1)) * 100)
    }
    for (const [bid, chapters] of Object.entries(backup.chapters)) {
      await api.ch.put(bid, JSON.stringify(chapters))
      done++
      dataOpProgress.value = Math.round((done / Math.max(total, 1)) * 100)
    }
    for (const bm of backup.bookmarks) {
      await api.bm.put(bm.id, JSON.stringify(bm))
      done++
      dataOpProgress.value = Math.round((done / Math.max(total, 1)) * 100)
    }
    for (const ann of backup.annotations) {
      await api.ann.put(ann.id, JSON.stringify(ann))
      done++
      dataOpProgress.value = Math.round((done / Math.max(total, 1)) * 100)
    }
    for (const [key, value] of Object.entries(backup.settings)) {
      await api.cfg.put(key, String(value))
      done++
      dataOpProgress.value = Math.round((done / Math.max(total, 1)) * 100)
    }
    if (backup.pinState) {
      const { encryptionKey, ...pinStateOnly } = backup.pinState as any
      await api.cfg.put('pinState', JSON.stringify(pinStateOnly))
      if (encryptionKey) {
        await api.cfg.put('encryptionKey', encryptionKey)
      }
    }

    await bookshelf.loadBooks()
    await settings.load()
    await checkPinStatus()
    await loadSecurityQuestion()

    webdavMessage.value = `已从 ${latest} 恢复数据`
    webdavMessageType.value = 'success'
  } catch (e: any) {
    webdavMessage.value = '恢复失败：' + (e.message || '未知错误')
    webdavMessageType.value = 'error'
  } finally {
    webdavRestoring.value = false
  }
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('zh-CN')
}

// ---- System ----
const systemAutoStart = ref(false)
const systemMinimizeToTray = ref(false)
const systemCloseToTray = ref(false)
const systemShowNotifications = ref(true)
const systemStartDelay = ref(0)
const systemTrayAction = ref<'show' | 'menu' | 'none'>('show')

async function loadSystemConfig() {
  try {
    const v = await api.cfg.get('systemConfig')
    if (v) {
      const cfg = JSON.parse(v)
      systemAutoStart.value = cfg.autoStart ?? false
      systemMinimizeToTray.value = cfg.minimizeToTray ?? false
      systemCloseToTray.value = cfg.closeToTray ?? false
      systemShowNotifications.value = cfg.showNotifications ?? true
      systemStartDelay.value = cfg.startDelay ?? 0
      systemTrayAction.value = cfg.trayAction ?? 'show'
    }
  } catch (e) { logger.error('加载系统配置失败', e) }
}

async function saveSystemConfig() {
  try {
    const cfg = {
      autoStart: systemAutoStart.value,
      minimizeToTray: systemMinimizeToTray.value,
      closeToTray: systemCloseToTray.value,
      showNotifications: systemShowNotifications.value,
      startDelay: systemStartDelay.value,
      trayAction: systemTrayAction.value
    }
    await api.cfg.put('systemConfig', JSON.stringify(cfg))
  } catch (e) {
    logger.error('保存系统配置失败', e)
  }
}

async function onAutoStartChange(v: boolean | null) {
  if (v === null) return
  systemAutoStart.value = v
  await saveSystemConfig()
  if (window.electronAPI?.setAutoStart) {
    window.electronAPI.setAutoStart(v)
  }
}

async function onMinimizeToTrayChange(v: boolean | null) {
  if (v === null) return
  systemMinimizeToTray.value = v
  await saveSystemConfig()
  if (window.electronAPI?.setStartMinimized) {
    window.electronAPI.setStartMinimized(v)
  }
}

// ---- Cache ----
const cacheSize = ref(0)
const cacheSizeCalculating = ref(false)
const showCacheClearDialog = ref(false)

const cacheSizeStr = computed(() => {
  if (cacheSize.value < 1024) return cacheSize.value + ' B'
  if (cacheSize.value < 1024 * 1024) return (cacheSize.value / 1024).toFixed(1) + ' KB'
  return (cacheSize.value / (1024 * 1024)).toFixed(1) + ' MB'
})

async function estimateCacheSize() {
  cacheSizeCalculating.value = true
  try {
    let totalSize = 0

    // Estimate DB size via a quick count of stored records
    const tables = [db.lib, db.ch, db.bm, db.ann, db.cfg]
    for (const table of tables) {
      const all = await table.toArray()
      for (const r of all) {
        const row = r as any
        totalSize += (row.data || row.v || '').length
        if (row.k) totalSize += row.k.length
        if (row.id) totalSize += String(row.id).length
        if (row.bid) totalSize += String(row.bid).length
      }
    }

    // Add a rough overhead for IndexedDB internal structures
    totalSize = Math.round(totalSize * 1.3)

    cacheSize.value = totalSize
  } catch (e) {
    logger.error('估算缓存大小失败', e)
    cacheSize.value = 0
  } finally {
    cacheSizeCalculating.value = false
  }
}

async function clearCache() {
  showCacheClearDialog.value = false
  try {
    // Clear covers (stored as data URLs in meta table)
    const allMetas = await getAllMetas()
    for (const m of allMetas) {
      if (m.cover && m.cover.startsWith('data:')) {
        m.cover = ''
        // Update meta with cleared cover — rebuild the full Book-like object for upsertMeta
        await upsertMeta({
          id: m.bid,
          title: m.title,
          author: m.author,
          cover: '',
          format: m.format,
          size: m.size,
          chapterCount: m.chapterCount,
          tags: m.tags,
          rating: m.rating,
          contentHash: m.contentHash,
          path: m.path,
          libraryId: m.libraryId,
          addedAt: m.addedAt,
          lastReadAt: m.lastReadAt,
          progress: m.progress,
          wordCount: m.wordCount,
          chapterIndex: 0,
          chapterProgress: 0,
          review: '',
          totalReadingTime: 0
        } as any)
      }
    }

    // Clear cached chapters (keep metadata but remove content caches)
    const allChapters = await api.ch.toArray()
    for (const r of allChapters) {
      const chData = typeof r.data === 'string' ? JSON.parse(r.data) : r
      if (Array.isArray(chData)) {
        for (const ch of chData) {
          // Mark chapters for re-parse — strip HTML content cache
          if (ch._parsedContent) {
            delete ch._parsedContent
          }
        }
        await api.ch.put(r.bid, JSON.stringify(chData))
      }
    }

    await estimateCacheSize()
    showSnackbar('缓存已清除', 'success')
  } catch (e: any) {
    showSnackbar('清除缓存失败：' + (e.message || ''), 'error')
  }
}

// ---- Snackbar ----
const snackbar = ref({ show: false, text: '', color: 'success' })

function showSnackbar(text: string, color: string = 'success') {
  snackbar.value = { show: true, text, color }
}

// ---- Lifecycle ----
onMounted(() => {
  checkPinStatus()
  loadShortcuts()
  loadSecurityQuestion()
  loadPinEscalation()
  initFontState()
  loadWebdavConfig()
  loadSystemConfig()
  estimateCacheSize()
  loadPageSizes()
})
</script>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
  padding-bottom: 40px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
}

.system-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.color-pickers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px 16px;
}

@media (max-width: 600px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
  .color-pickers-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.gap-2 {
  gap: 8px;
}

.gap-3 {
  gap: 12px;
}

.gap-4 {
  gap: 16px;
}

.color-swatch {
  cursor: pointer;
  border: 2px solid rgba(128,128,128,0.3);
  transition: transform 0.15s;
  flex-shrink: 0;
}

.color-swatch:hover {
  transform: scale(1.12);
}

.hidden-picker {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.mono {
  font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  font-size: 11px;
}

.border-t {
  border-top: 1px solid rgba(var(--v-border-color), 0.4);
}

.flex-1-0 {
  flex: 1 0 auto;
}

.shortcut-capturing :deep(input) {
  color: var(--v-primary-base) !important;
  font-weight: bold;
}

.shortcut-kbd {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.kbd-chip {
  font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace !important;
  letter-spacing: 0.5px;
  min-width: 22px;
  justify-content: center;
}

.shortcut-conflict {
  animation: conflict-pulse 1.5s ease-in-out infinite;
}

@keyframes conflict-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>

根据任何用户请求，为一个或多个LLM函数调用生成JSON结构。JSON应包含函数的名称、描述、严格性以及参数及其类型和描述。

## 要求

JSON必须包含：
- `name`：表示函数名称的字符串。
- `description`：描述函数用途的字符串。如适用，请包含“何时使用”和“何时不使用”。
- `strict`：布尔值，指示函数调用是否应严格。
- `parameters`：详细说明函数参数的对象。
    - `type`：必须为“object”。
    - `required`：必需参数名称的数组。
    - `properties`：一个对象，其中每个键是参数名称，值是一个包含以下内容的对象：
        - `type`：参数的数据类型。
        - `description`：描述参数的字符串。
    - `additionalProperties`：布尔值，指示是否允许附加属性。
- 遵循Python PEP 8风格。

## 输出格式

{
  "name": "function_name",
  "description": "函数描述。",
  "strict": true,
  "parameters": {
    "type": "object",
    "required": ["parameter1", "parameter2"],
    "properties": {
      "parameter1": {
        "type": "data_type",
        "description": "parameter1的描述"
      },
      "parameter2": {
        "type": "data_type",
        "description": "parameter2的描述"
      }
    },
    "additionalProperties": false
  }
}

## 示例

**输入：** 创建一个计算矩形面积的函数。

**输出：**

{
  "name": "calculate_rectangle_area",
  "description": "给定矩形的宽度和高度，计算其面积。",
  "strict": true,
  "parameters": {
    "type": "object",
    "required": ["width", "height"],
    "properties": {
      "width": {
        "type": "number",
        "description": "矩形的宽度"
      },
      "height": {
        "type": "number",
        "description": "矩形的高度"
      }
    },
    "additionalProperties": false
  }
}

---

**输入：** ls

**输出：**

{
  "name": "ls",
  "description": "列出指定目录的内容。当您需要查看目录中的文件和文件夹时使用。请勿用于文件操作或内容读取。",
  "strict": true,
  "parameters": {
    "type": "object",
    "required": ["description", "path"],
    "properties": {
      "description": {
        "type": "string",
        "description": "必须是工具调用中的第一个参数。向用户解释为什么需要执行此操作"
      },
      "path": {
        "type": "string",
        "description": "要列出内容的绝对目录路径"
      },
      "show_hidden": {
        "type": "boolean",
        "description": "是否显示隐藏文件（以.开头的文件）"
      },
      "sort_by": {
        "type": "string",
        "description": "排序方式：'name'、'date'、'size'或'type'"
      }
    },
    "additionalProperties": false
  }
}

## 备注
- 仅输出一个函数（第一个）。
- 直接输出**JSON原始字符串**，不要使用“```json”。
```
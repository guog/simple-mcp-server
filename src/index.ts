import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js' // MCP 服务器模块
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js' // 标准输入输出传输模块
import { z } from 'zod' // 数据验证和解析库
import dotenv from 'dotenv'

dotenv.config()

// 高德API的基础URL
const GAODE_API_BASE = 'https://restapi.amap.com/v3'
// 高德API密钥
const GAODE_API_KEY = process.env.GAODE_API_KEY

// 创建 MCP 服务器实例
const server = new McpServer({
  name: '@guog/simple-mcp-server', // 服务器名称
  version: '0.1.0' // 服务器版本
})

server.tool(
  '获取实时天气',
  '获取指定位置的实况天气,根据用户输入的经纬度,查询目标区域当前的天气情况',
  {
    latitude: z.number().min(-90).max(90).describe('Latitude of the location'), // 参数验证：纬度
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe('Longitude of the location') // 参数验证：经度
  },
  async ({ latitude, longitude }) => {
    const adcode = await getAdcodeFromCoordinates(latitude, longitude)
    const weatherUrl = `${GAODE_API_BASE}/weather/weatherInfo?key=${GAODE_API_KEY}&city=${adcode}&extensions=base&output=json`
    const response = await fetch(weatherUrl, {
      headers: {
        Authorization: `Bearer ${GAODE_API_KEY}`
      }
    })
    const data = await response.json()

    if (!data) {
      // 如果请求失败，返回错误消息
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve grid point data for adcode: ${adcode}. This adcode may not be supported by the Gaode API (only China locations are supported).`
          }
        ]
      }
    }

    let text = '' // 将高德返回的天气数据JSON转换为文本格式
    if (data.lives && data.lives.length > 0) {
      const live = data.lives[0]
      text += `${live.province} ${live.city} 实况天气：${live.weather}, 温度：${live.temperature},风向:${live.winddirection}, 风力:${live.windpower}, 空气湿度:${live.humidity};`
    }

    return {
      content: [
        {
          type: 'text',
          text
        }
      ]
    }
  }
)

server.tool(
  '获取未来天气',
  '获取指定位置的未来几天的天气预报,根据用户输入的经纬度,查询目标区域未来的天气情况',
  {
    latitude: z.number().min(-90).max(90).describe('Latitude of the location'), // 参数验证：纬度
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe('Longitude of the location') // 参数验证：经度
  },
  async ({ latitude, longitude }) => {
    const adcode = await getAdcodeFromCoordinates(latitude, longitude)
    const weatherUrl = `${GAODE_API_BASE}/weather/weatherInfo?key=${GAODE_API_KEY}&city=${adcode}&extensions=all&output=json`
    const response = await fetch(weatherUrl, {
      headers: {
        Authorization: `Bearer ${GAODE_API_KEY}`
      }
    })
    const data = await response.json()

    if (!data) {
      // 如果请求失败，返回错误消息
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve grid point data for adcode: ${adcode}. This adcode may not be supported by the Gaode API (only China locations are supported).`
          }
        ]
      }
    }

    let text = ''
    if (data.lives && data.lives.length > 0) {
      const live = data.lives[0]

      text += `${live.province} ${live.city} 实况天气：${live.weather}, 温度：${live.temperature},风向:${live.winddirection}, 风力:${live.windpower}, 空气湿度:${live.humidity};`
    }

    if (data.forecasts && data.forecasts.length > 0) {
      const forecast = data.forecasts[0]
      text += `未来${forecast.casts.length}日天气：`
      for (const cast of forecast.casts) {
        text += `----------------------------
${cast.date}(周${cast.week})天气
白天:${cast.dayweather},白天温度是${cast.daytemp}度,白天风向是${cast.daywind},白天风力${cast.daypower}级
夜间:${cast.nightweather}, 夜间温度：${cast.nighttemp}, 夜间风向是${cast.nightwind},夜间风力为${cast.nightpower}级
`
      }
    }

    return {
      content: [
        {
          type: 'text',
          text
        }
      ]
    }
  }
)

// 主函数：启动 MCP 服务器
async function main() {
  const transport = new StdioServerTransport() // 使用标准输入输出作为传输方式
  await server.connect(transport) // 连接服务器
  console.error('Weather MCP Server running on stdio') // 输出服务器启动消息
}

// 捕获主函数中的错误并退出进程
main().catch(error => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})

async function getAdcodeFromCoordinates(latitude: number, longitude: number) {
  const url = `${GAODE_API_BASE}/geocode/regeo?output=json&location=${longitude},${latitude}&key=${GAODE_API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  if (
    !data ||
    !data.regeocode ||
    !data.regeocode.addressComponent ||
    !data.regeocode.addressComponent.adcode
  ) {
    throw new Error('Failed to retrieve adcode from coordinates')
  }
  return data.regeocode.addressComponent.adcode
}

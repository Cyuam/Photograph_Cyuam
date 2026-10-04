"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent, ImgHTMLAttributes, MouseEvent } from "react"
import { useRouter } from "next/navigation"
import "leaflet/dist/leaflet.css"
import {
  ArrowDown,
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  Heart,
  Images,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

type Locale = "zh" | "en"

type Photo = {
  id: string
  src: string
  alt: string
}

type Location = {
  id: string
  name: string
  place: string
  mood: string
  bestTime: string
  lat: number
  lng: number
  href: string
}

type ShootStep = {
  eyebrow: string
  title: string
  body: string
  image: Photo
}

type MomentCard = Photo & {
  title: string
  place: string
  note: string
  featured?: boolean
  tags: string[]
  sourceName?: string
}

type MomentGroup = {
  id: string
  title: string
  place: string
  note: string
  featured?: boolean
  hideCaption?: boolean
  photoCount?: number
  tags: string[]
  photos: MomentCard[]
}

type Testimonial = {
  quote: string
  name: string
  context: string
}

const xhsHref = "https://xhslink.com/m/7aNml9q2AjQ"

const photoSessionCopy = {
  zh: {
    languageButton: "EN",
    languageLabel: "切换到英文",
    momentTypeCouple: "情侣拍摄",
    hero: {
      title: "CN",
      samples: "样片",
      portfolio: "摄影集",
      booking: "预约",
    },
    about: {
      eyebrow: "About me",
      title: "CN",
      body: "CN",
      highlightLines: [
        "CN",
        "CN",
        "CN",
      ],
    },
    process: {
      eyebrow: "Why ME",
      title: "我的责任，是把拍摄当天也照顾好",
      steps: [
        {
          title: "路线可以我定，也可以你定",
          body: "路线优先选，不让转场吃掉拍摄时间。我会按时间、光线和转场安排路线，你也可以提供自己的路线。",
        },
        {
          title: "不要求你本来就是模特",
          body: "现场会给动作指导。走路、坐下、不看镜头、大头照、游客照，都可以自然完成。",
        },
        {
          title: "设备可以很自由",
          body: "我会用自己的设备，也可以用你的设备拍。数码、胶片、CCD、拍立得都可以提前沟通。",
        },
        {
          title: "熟悉赫尔辛基现场",
          body: "我在这里生活两年，也是在校学生，更清楚该去哪拍、怎么走、哪段路更适合你。",
        },
        {
          title: "稳定、耐心，也好相处",
          body: "拍摄过程会轻松一点。我可以帮你扛东西和器材，也可以像摄影搭子一样一起行动。",
        },
        {
          title: "可以像地陪一样带你玩",
          body: "如果你愿意，我也可以顺路带你吃吃喝喝，把拍摄变成半天城市散步。",
        },
        {
          title: "规则提前写清楚",
          body: "价格、交付、取消和额外费用都会提前确认，网站和小红书也会持续写清楚。",
        },
        {
          title: "全欧可飞，也接受亚洲旅拍",
          body: "你承担对应路费、住宿、门票等成本，我就可以配合远距离路线和旅拍计划。",
        },
      ],
    },
    options: {
      eyebrow: "Details / shooting brief",
      titleTop: "你定大概",
      titleBottom: "我定方案",
      typesTitle: "可以拍什么",
      languagesTitle: "可以说什么",
      briefTitle: "可以定什么",
      serviceTypes: ["旅拍 / 游客照", "情侣拍照", "家庭拍照", "证件照", "宠物照片", "毕业写真", "校园写真"],
      languageItems: ["中文", "English", "粤语"],
      briefItems: ["人数", "日期", "大概地点", "想拍的样式"],
    },
    locations: {
      eyebrow: "Routes",
      title: "默认赫尔辛基路线",
      body: "只是默认参考，具体路线可以按天气、时间和你想拍的感觉修改。",
      points: [
        { place: "白教堂 / Senate Square", bestTime: "下午侧光" },
        { place: "码头 / Market Square", bestTime: "16:00 后" },
        { place: "咖啡店 / Jugend hall", bestTime: "阴天也稳" },
        { place: "喷泉 / Esplanadi edge", bestTime: "下午或傍晚" },
        { place: "Otaniemi / Aalto University", bestTime: "下午或课后" },
        { place: "芬兰堡 / sea fortress", bestTime: "日落前" },
      ],
    },
    testimonials: {
      eyebrow: "Shooting experience",
      title: "拍摄体验反馈",
      items: [
        {
          quote: "一开始其实很担心自己不会拍照，但现场不是那种被命令摆姿势的感觉。会边走边调整动作，也会告诉我手放哪里、看哪里，最后照片比我平时自拍自然很多。",
          name: "Z. Li",
          context: "第一次单人约拍",
        },
        {
          quote: "路线不是把景点一个个打卡，而是会看光线和我们当时的状态。拍完有一些远景，也有很多聊天走路时抓到的瞬间，比较像真的旅行记忆。",
          name: "Rico",
          context: "瑞士旅拍",
        },
        {
          quote: "我不太喜欢太正式的毕业照，所以重点放在校园、衣服和当天的情绪上。成片没有很僵，也保留了学校环境，发给家里人和朋友都很合适。",
          name: "H. Jia",
          context: "校园 / 毕业记录",
        },
        {
          quote: "沟通的时候会把价格、加钱项和交付讲清楚，所以拍之前没有那种不确定感。现场也会帮忙看包、看衣服，整体更像有人一起把这件事照顾好。",
          name: "D. Wang",
          context: "旅行人像",
        },
        {
          quote: "我只给了大概想去的地点，最后路线被重新排过，基本没有把时间浪费在乱走上。照片里既有地点，也有人在里面的状态。",
          name: "Junjie",
          context: "旅途中记录",
        },
        {
          quote: "收到图以后最喜欢的是那些没有刻意看镜头的照片。它们不是模板照，更像那天真的发生过的片段，这一点对我来说很重要。",
          name: "M. Chen",
          context: "自然街拍",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "约拍价格",
      note: "具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。",
      packages: [
        { name: "单人", price: "EUR 99", note: "2 小时" },
        { name: "双人 / 情侣", price: "EUR 139", note: "2 小时" },
        { name: "三人", price: "EUR 169", note: "2 小时" },
        { name: "四人及以上", price: "另议", note: "按人数和路线确认" },
      ],
    },
    delivery: {
      eyebrow: "Delivery / rules",
      title: "交付和边界",
      includedTitle: "交付包含",
      boundaryTitle: "费用与边界",
      includedItems: ["拍摄前路线和风格沟通", "2 小时拍摄与动作引导", "筛选后 JPG 底片", "9 张精修", "9 张精修图对应 RAW 文件"],
      boundaryItems: [
        "续时 EUR 40 / 小时；额外精修 EUR 2 / 张",
        "下雪或小雨如确认继续拍摄，加 EUR 5 / 小时",
        "旅拍、远距离地点、门票和交通费需实报实销",
        "精心二次后期后仍不满意，可以要求退款",
        "妆发需自理；未经同意不会公开发布照片",
      ],
    },
    contact: {
      eyebrow: "Booking",
      title: "预约流程",
      processItems: ["私信沟通并选定套餐", "约定时间和地点，拍摄当天提前会合", "拍完后五天以内返回照片；加钱可加急"],
      xhsTitle: "小红书私信",
      xhsBody: "适合先发样片参考、截图和大概日期。点击后跳转到小红书。",
      xhsAction: "打开私信",
      emailTitle: "邮件预约",
      emailBody: "适合一次性把人数、日期、路线和想法写清楚。点击后填写表单。",
      emailAction: "填写信息",
    },
    form: {
      eyebrow: "Email booking",
      title: "填写预约信息",
      packagePrefix: "当前套餐",
      close: "关闭",
      name: "怎么称呼",
      namePlaceholder: "你的名字",
      date: "预计日期 / 时间",
      datePlaceholder: "例如：7 月某个周末 / 8 月初下午",
      contact: "联系方式",
      contactPlaceholder: "微信 / 小红书 / 邮箱 / 电话",
      people: "人数",
      peoplePlaceholder: "例如：1 人 / 情侣 / 家庭",
      style: "想拍什么",
      stylePlaceholder: "游客照 / 自然街拍 / 写真感",
      note: "其他信息",
      notePlaceholder: "想去的地点、设备、服装、是否旅拍等",
      summaryTitle: "将发送",
      dateFallback: "预计日期待填写",
      timeFallback: "具体时间再沟通",
      timeWindow: "待沟通",
      timeWindowNote: "页面未预设时间段",
      sending: "发送中",
      submit: "发送预约信息",
      sentMessage: "预约信息已发送。",
      loggedMessage: "预约信息已记录；邮件暂时没有发送成功，我会从后台日志处理。",
      errorMessage: "发送失败，请稍后再试。",
    },
    faq: {
      eyebrow: "FAQ",
      title: "拍之前最常问到的问题。",
      items: [
        { question: "可以拍视频吗？", answer: "目前只接照片拍摄，不接正式视频拍摄。我的重点会放在静态照片里的人物状态、地点感和旅行氛围。" },
        { question: "预约之后会发生什么？", answer: "确认预约后，我会和你对齐套餐、集合点、拍摄时间、穿搭和想要的感觉。拍摄前可以继续私信沟通，把不确定的地方先处理掉。" },
        { question: "需要提前多久预约？", answer: "建议至少提前一周来问，旺季或旅行日期比较固定时最好提前四周。临时约也可以问，但不保证一定能接；如果是求婚、惊喜或需要隐藏安排的拍摄，建议至少提前两周。" },
        { question: "赫尔辛基约拍多少钱？", answer: "基础价格按上面的套餐走：单人 EUR 99 / 2 小时起，双人 / 情侣 EUR 139 / 2 小时起。具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。" },
        { question: "在赫尔辛基找摄影师值得吗？", answer: "如果你希望把旅行、毕业、纪念日或普通的一天留下来，是值得的。当地摄影师会更熟悉光线、天气、适合走路的区域和不太挤的角度，照片会比单纯打卡更像你那天真实的状态。" },
        { question: "拍摄当天和交付时间是怎样的？", answer: "拍摄当天建议提前 10 分钟到集合点，先确认当天目标和节奏。拍完后一般五天以内返回照片；如果你需要更快拿到图，可以提前说，加急会单独加钱。" },
        { question: "阴天还能拍吗？", answer: "阴天可以正常拍，柔光反而适合人像。下雪或小雨也可以拍，但会加 EUR 5 / 小时；恶劣天气可以免费改期或取消。" },
        { question: "怎么付款和取消？", answer: "确认档期需要支付总价 50% 订金。拍摄前 24 小时外取消可退订金，24 小时内取消订金不退。支持微信、支付宝、Revolut、MobilePay。" },
        { question: "如果我迟到了怎么办？", answer: "我会在约定地点等你，但拍摄时间会从我们约定的开始时间计时，不会从你实际到达后重新开始。请尽量准时到达，这样 2 小时才会完整用在拍摄上。" },
        { question: "如果精修风格不满意呢？", answer: "可以先沟通二次后期。如果精心二次后期之后你仍然不满意，可以要求退款。" },
        { question: "可以去赫尔辛基以外吗？", answer: "可以。Base赫尔辛基，但拍摄不只限芬兰，全欧可飞。远距离路线、欧洲其他城市或亚洲旅拍，需要你承担对应路费、住宿、门票和必要转场费用。" },
        { question: "交付包含什么？", answer: "基础包含筛选后 JPG 底片、9 张精修，以及 9 张精修图对应 RAW 文件。额外精修 EUR 2 / 张，续时 EUR 40 / 小时。" },
        { question: "衣服需要提前准备吗？", answer: "建议提前看颜色和层次。赫尔辛基风大，外套、围巾或能随手搭的单品会更好拍；如果你不确定，也可以把衣服发给我一起看。" },
        { question: "照片会被公开发布吗？", answer: "不会默认公开。未经你同意，我不会把你的照片发布到网站、小红书或其他公开平台。" },
      ],
    },
    footer: {
      title: "CN",
      notice: "CN",
      booking: "预约方式",
      top: "回到顶部",
    },
  },
  en: {
    languageButton: "中",
    languageLabel: "Switch to Chinese",
    momentTypeCouple: "Couple session",
    hero: {
      title: "Travel Photographer - Lijie",
      samples: "Samples",
      portfolio: "Portfolio",
      booking: "Book",
    },
    about: {
      eyebrow: "About me",
      title: "I am your travel photo buddy",
      body: "I am not only the person pressing the shutter. During the shoot, I talk with you, read your pace, and help the day feel lighter when you get nervous. The photos should look good, but the day itself should also feel good.",
      highlightLines: [
        "Based in Helsinki, available across Finland, Europe, and Asia travel sessions",
        "I am a fun person, and my job is to bring you joy and beautiful photos",
        "Calm, patient, good at guiding, and generous with emotional support",
      ],
    },
    process: {
      eyebrow: "Why me",
      title: "I take care of the shoot day, not only the camera",
      steps: [
        {
          title: "I can plan the route, or we can use yours",
          body: "The route is planned so that transfers do not eat the session. I arrange it around time, light, and walking distance, and you can also bring your own route ideas.",
        },
        {
          title: "You do not need to be a model",
          body: "I will guide you on the spot. Walking, sitting, looking away, close portraits, and tourist-style photos can all feel natural.",
        },
        {
          title: "The camera setup can be flexible",
          body: "I can shoot with my own gear, and we can also include yours. Digital, film, CCD, and instant cameras can all be discussed in advance.",
        },
        {
          title: "I know Helsinki on the ground",
          body: "I have lived here for two years and study here, so I know where to go, how to walk, and which parts of the route fit different people.",
        },
        {
          title: "Stable, patient, easy to be around",
          body: "The shoot should feel relaxed. I can help with bags and gear, and move through the city like a photo companion rather than a distant vendor.",
        },
        {
          title: "It can feel like a city walk",
          body: "If you want, I can also take you for food, coffee, and small local stops, turning the shoot into a half-day city walk.",
        },
        {
          title: "Rules are clear before we shoot",
          body: "Price, delivery, cancellation, and extra fees are confirmed in advance. The website and Xiaohongshu will keep these details visible.",
        },
        {
          title: "Europe-wide, and Asia travel sessions are possible",
          body: "If travel, accommodation, tickets, and transfer costs are covered, I can work with longer routes and travel-session plans.",
        },
      ],
    },
    options: {
      eyebrow: "Details / shooting brief",
      titleTop: "You set the idea",
      titleBottom: "I shape the plan",
      typesTitle: "What we can shoot",
      languagesTitle: "Languages",
      briefTitle: "What you can decide",
      serviceTypes: ["Travel photos", "Couple photos", "Family photos", "ID photos", "Pet photos", "Graduation portraits", "Campus portraits"],
      languageItems: ["Chinese", "English", "Cantonese"],
      briefItems: ["People", "Date", "Rough location", "Visual style"],
    },
    locations: {
      eyebrow: "Routes",
      title: "Default Helsinki Route",
      body: "This is only a default reference. The route can change with weather, time, and the mood you want in the photos.",
      points: [
        { place: "Helsinki Cathedral / Senate Square", bestTime: "Afternoon side light" },
        { place: "Market Square / Harbor", bestTime: "After 16:00" },
        { place: "Robert's Coffee Jugend / Indoor backup", bestTime: "Reliable on cloudy days" },
        { place: "Havis Amanda / Esplanadi edge", bestTime: "Afternoon or evening" },
        { place: "Otaniemi / Aalto University", bestTime: "Afternoon or after class" },
        { place: "Suomenlinna / Sea fortress", bestTime: "Before sunset" },
      ],
    },
    testimonials: {
      eyebrow: "Shooting experience",
      title: "Client feedback",
      items: [
        {
          quote: "I was worried that I would not know how to pose, but it did not feel like being ordered around. We adjusted while walking, and I was told where to put my hands and where to look. The final photos felt much more natural than my selfies.",
          name: "Z. Li",
          context: "First solo portrait session",
        },
        {
          quote: "The route was not just a checklist of landmarks. It followed the light and our state that day. The photos included wide scenes and small walking moments, more like real travel memories.",
          name: "Rico",
          context: "Switzerland travel session",
        },
        {
          quote: "I did not want formal graduation photos, so we focused on the campus, clothes, and the feeling of the day. The images were not stiff and still kept the school environment.",
          name: "H. Jia",
          context: "Campus / graduation record",
        },
        {
          quote: "The price, add-ons, and delivery were explained clearly, so there was much less uncertainty before the shoot. On the day, there was also help with bags and clothes.",
          name: "D. Wang",
          context: "Travel portraits",
        },
        {
          quote: "I only gave a rough location idea, and the route was rearranged so we did not waste time walking randomly. The photos kept both the place and the person inside it.",
          name: "Junjie",
          context: "Travel record",
        },
        {
          quote: "My favorites were the photos where I was not deliberately looking at the camera. They were not template shots. They felt like something that really happened that day.",
          name: "M. Chen",
          context: "Natural street portraits",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "Session pricing",
      note: "Final details may be adjusted slightly based on the actual plan, group size, and delivery needs. Everything will be confirmed before booking.",
      packages: [
        { name: "Solo", price: "EUR 99", note: "2 hours" },
        { name: "Two people / couple", price: "EUR 139", note: "2 hours" },
        { name: "Three people", price: "EUR 169", note: "2 hours" },
        { name: "Four or more", price: "Custom", note: "Confirmed by group and route" },
      ],
    },
    delivery: {
      eyebrow: "Delivery / rules",
      title: "Delivery and boundaries",
      includedTitle: "Included",
      boundaryTitle: "Fees and boundaries",
      includedItems: ["Pre-shoot route and style discussion", "2-hour shoot with posing guidance", "Selected JPG originals", "9 retouched photos", "RAW files for the 9 retouched photos"],
      boundaryItems: [
        "Extra time EUR 40 / hour; extra retouching EUR 2 / photo",
        "If we confirm shooting in snow or light rain, add EUR 5 / hour",
        "Travel sessions, distant locations, tickets, and transport are reimbursed at actual cost",
        "If you are still unhappy after careful second-round editing, you can request a refund",
        "Makeup and hair are self-arranged; photos will not be published without consent",
      ],
    },
    contact: {
      eyebrow: "Booking",
      title: "Booking process",
      processItems: ["Message me and choose a package", "Agree on time and meeting point, then meet before the shoot", "Photos are delivered within about five days; rush delivery is available for an extra fee"],
      xhsTitle: "Xiaohongshu message",
      xhsBody: "Best for sending sample references, screenshots, and rough dates first. Click to open Xiaohongshu.",
      xhsAction: "Open message",
      emailTitle: "Email booking",
      emailBody: "Best when you want to write the group size, date, route, and ideas in one place. Click to fill the form.",
      emailAction: "Fill form",
    },
    form: {
      eyebrow: "Email booking",
      title: "Fill booking details",
      packagePrefix: "Selected package",
      close: "Close",
      name: "Name",
      namePlaceholder: "Your name",
      date: "Expected date / time",
      datePlaceholder: "For example: a weekend in July / early August afternoon",
      contact: "Contact",
      contactPlaceholder: "WeChat / Xiaohongshu / email / phone",
      people: "People",
      peoplePlaceholder: "For example: solo / couple / family",
      style: "What do you want to shoot",
      stylePlaceholder: "Travel photos / natural street portraits / editorial portraits",
      note: "Other details",
      notePlaceholder: "Places, gear, clothes, travel-session plans, and anything else",
      summaryTitle: "Will send",
      dateFallback: "Date to be filled",
      timeFallback: "Exact time to discuss",
      timeWindow: "To discuss",
      timeWindowNote: "No preset time window on page",
      sending: "Sending",
      submit: "Send booking request",
      sentMessage: "Your booking request has been sent.",
      loggedMessage: "Your request was logged; the email could not be sent yet, so I will handle it from the admin log.",
      errorMessage: "Sending failed. Please try again later.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions before booking.",
      items: [
        { question: "Do you offer Helsinki videographers?", answer: "At the moment, I focus on photography only. The goal is to capture people, place, and travel atmosphere through still images." },
        { question: "What happens after I book a Helsinki photo session?", answer: "After confirmation, we align on the package, meeting point, time, outfits, and the mood you want. You can keep messaging me before the shoot to clear up details." },
        { question: "How far in advance should I book?", answer: "At least one week is recommended. For fixed travel dates or busy seasons, four weeks is better. Last-minute requests are welcome but not guaranteed. For proposals or surprise plans, at least two weeks is recommended." },
        { question: "How much does a photographer cost in Helsinki?", answer: "The base packages start from EUR 99 / 2 hours for solo sessions and EUR 139 / 2 hours for two people or couples. Final details may shift slightly with the actual plan, group size, and delivery needs." },
        { question: "Is it worth hiring a photographer in Helsinki?", answer: "If you want to keep a trip, graduation, anniversary, or even an ordinary day, yes. A local photographer knows the light, weather, walkable areas, and quieter angles, so the photos can feel more like your real day than simple check-in shots." },
        { question: "What happens on the shoot day and when do I receive photos?", answer: "Please arrive about 10 minutes early so we can confirm the goal and rhythm. Photos are usually delivered within five days. Rush delivery can be discussed for an extra fee." },
        { question: "Can we shoot on cloudy days?", answer: "Yes. Cloudy light is often good for portraits. Snow or light rain can also work with an extra EUR 5 / hour. For bad weather, we can reschedule or cancel for free." },
        { question: "How do payment and cancellation work?", answer: "A 50% deposit confirms the slot. If you cancel more than 24 hours before the shoot, the deposit is refundable. Within 24 hours, it is not refundable. WeChat, Alipay, Revolut, and MobilePay are supported." },
        { question: "What if I am late?", answer: "I will wait at the agreed place, but the session time starts from the agreed start time rather than your actual arrival time. Please arrive on time so the full two hours can be used for shooting." },
        { question: "What if I do not like the retouching style?", answer: "We can first discuss a second editing round. If you are still unhappy after careful second-round editing, you can request a refund." },
        { question: "Can we shoot outside Helsinki?", answer: "Yes. I am based in Helsinki, but sessions are not limited to Finland. For other European cities or Asia travel sessions, travel, accommodation, tickets, and necessary transfer costs need to be covered." },
        { question: "What is included in delivery?", answer: "The base package includes selected JPG originals, 9 retouched photos, and RAW files for those 9 retouched photos. Extra retouching is EUR 2 / photo, and extra time is EUR 40 / hour." },
        { question: "Should I prepare outfits in advance?", answer: "It helps to think about color and layers ahead of time. Helsinki can be windy, so coats, scarves, or easy layering pieces often work well. If you are unsure, you can send me options to discuss." },
        { question: "Will my photos be published?", answer: "Not by default. Without your consent, I will not post your photos on the website, Xiaohongshu, or other public platforms." },
      ],
    },
    footer: {
      title: "Travel photographer / Based in Helsinki",
      notice: "Images on this site may not be used, copied, downloaded, reposted, used for training, or used commercially without permission. Please use the booking entry above for inquiries.",
      booking: "Booking",
      top: "Back to top",
    },
  },
} as const

function SessionImage({ className = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
      className={`${className} select-none`}
    />
  )
}

const getMomentTileClass = (photoCount: number, index: number) => {
  if (photoCount >= 5) {
    return [
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-3 row-span-2",
      "col-span-6 row-span-2",
    ][index] ?? "col-span-6 row-span-2"
  }

  if (photoCount === 4) {
    return [
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
    ][index] ?? "col-span-3 row-span-3"
  }

  if (photoCount === 3) {
    return [
      "col-span-3 row-span-3",
      "col-span-3 row-span-3",
      "col-span-6 row-span-3",
    ][index] ?? "col-span-6 row-span-3"
  }

  if (photoCount === 2) {
    return "col-span-6 row-span-3"
  }

  return "col-span-6 row-span-6"
}

function MomentPhotoMosaic({
  photos,
  eager = false,
  imageFit = "cover",
}: {
  photos: MomentCard[]
  eager?: boolean
  imageFit?: "cover" | "contain"
}) {
  const visiblePhotos = photos.slice(0, 5)

  return (
    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-1.5 p-1.5">
      {visiblePhotos.map((photo, index) => (
        <figure
          key={`${photo.id}-${index}`}
          className={`${getMomentTileClass(visiblePhotos.length, index)} overflow-hidden rounded-[3px] bg-[#050505]`}
        >
          <SessionImage
            src={photo.src}
            alt={photo.alt}
            className={`h-full w-full object-center transition duration-700 group-hover:scale-[1.025] ${
              imageFit === "contain" ? "object-contain" : "object-cover"
            }`}
            loading={eager || index < 2 ? "eager" : "lazy"}
          />
        </figure>
      ))}
    </div>
  )
}

function getMomentPlaceLabel(group: MomentGroup) {
  if (group.id === "jianji-xinyi") return "Barcelona / Croatia"
  return group.place
}

function getMomentTypeLabel(group: MomentGroup, locale: Locale) {
  if (group.id === "jianji-xinyi") return photoSessionCopy[locale].momentTypeCouple
  return ""
}

function MomentGroupFrame({
  group,
  eager = false,
  className = "",
  imageFit = "cover",
  locale = "zh",
}: {
  group: MomentGroup
  eager?: boolean
  className?: string
  imageFit?: "cover" | "contain"
  locale?: Locale
}) {
  const typeLabel = getMomentTypeLabel(group, locale)

  return (
    <article
      className={`group relative min-h-[56svh] min-w-[82vw] snap-center overflow-hidden rounded-md bg-white/[0.045] shadow-[0_26px_90px_-70px_rgba(255,255,255,0.35)] sm:min-w-[58vw] lg:min-h-0 lg:min-w-0 ${className}`}
    >
      <MomentPhotoMosaic photos={group.photos} eager={eager} imageFit={imageFit} />
      {!group.hideCaption && (
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))] px-4 pb-4 pt-20">
          <p className="text-sm font-semibold uppercase tracking-normal text-white/82">{getMomentPlaceLabel(group)}</p>
          {typeLabel && <p className="mt-1 text-xs font-semibold text-white/58">{typeLabel}</p>}
        </div>
      )}
    </article>
  )
}

const coverPhoto: Photo = {
  id: "cover-photo",
  src: "/photo-session/微信图片_20261004190518_176_230.jpg",
  alt: "摄影作品封面",
}

const galleryPhotos: Photo[] = [
  {
    id: "gallery-1",
    src: "/photo-session/微信图片_20261004190518_176_230.jpg",
    alt: "摄影作品 1",
  },
  {
    id: "gallery-2",
    src: "/photo-session/微信图片_20261004190737_177_230.jpg",
    alt: "摄影作品 2",
  },
  {
    id: "gallery-3",
    src: "/photo-session/微信图片_20261004190738_178_230.jpg",
    alt: "摄影作品 3",
  },
  {
    id: "gallery-4",
    src: "/photo-session/微信图片_20261004190740_179_230.jpg",
    alt: "摄影作品 4",
  },
  {
    id: "gallery-5",
    src: "/photo-session/微信图片_20261004190742_180_230.jpg",
    alt: "摄影作品 5",
  },
  {
    id: "gallery-6",
    src: "/photo-session/微信图片_20261004190744_181_230.jpg",
    alt: "摄影作品 6",
  },
]

const highlightLines = [
  "Base赫尔辛基，但拍摄不只限芬兰，全欧可飞",
  "我是一个有趣的人，我的责任是给你带来快乐和美丽的照片",
  "情绪稳定，懂得引导，会给情绪价值",
]

const locations: Location[] = [
  {
    id: "cathedral",
    name: "Helsingin tuomiokirkko",
    place: "白教堂 / Senate Square",
    mood: "干净、明亮、赫尔辛基标志感",
    bestTime: "下午侧光",
    lat: 60.17045,
    lng: 24.95223,
    href: "https://www.openstreetmap.org/search?query=Helsingin%20tuomiokirkko",
  },
  {
    id: "kauppatori",
    name: "Kauppatori",
    place: "码头 / Market Square",
    mood: "海风、码头、旅行感",
    bestTime: "16:00 后",
    lat: 60.16748,
    lng: 24.95532,
    href: "https://www.openstreetmap.org/search?query=Kauppatori%20Helsinki",
  },
  {
    id: "roberts",
    name: "Robert's Coffee Jugend",
    place: "咖啡店 / Jugend hall",
    mood: "室内、复古、雨天备用",
    bestTime: "阴天也稳",
    lat: 60.16708,
    lng: 24.9481,
    href: "https://www.openstreetmap.org/search?query=Robert%27s%20Coffee%20Jugend%20Helsinki",
  },
  {
    id: "havis",
    name: "Havis Amanda",
    place: "喷泉 / Esplanadi edge",
    mood: "广场、喷泉、路口感",
    bestTime: "下午或傍晚",
    lat: 60.16712,
    lng: 24.95139,
    href: "https://www.openstreetmap.org/search?query=Havis%20Amanda%20Helsinki",
  },
  {
    id: "aalto",
    name: "Aalto",
    place: "Otaniemi / Aalto University",
    mood: "校园写真、毕业记录、学生日常",
    bestTime: "下午或课后",
    lat: 60.18416,
    lng: 24.83013,
    href: "https://www.openstreetmap.org/search?query=Aalto%20University%20Otaniemi",
  },
  {
    id: "suomenlinna",
    name: "Suomenlinna",
    place: "芬兰堡 / sea fortress",
    mood: "岛、海边、风很大的旅行感",
    bestTime: "日落前",
    lat: 60.14499,
    lng: 24.98757,
    href: "https://www.openstreetmap.org/search?query=Suomenlinna",
  },
]

const shootSteps: ShootStep[] = [
  {
    eyebrow: "01 / Route",
    title: "路线可以我定，也可以你定",
    body: "路线优先选，不让转场吃掉拍摄时间。我会按时间、光线和转场安排路线，你也可以提供自己的路线。",
    image: coverPhoto,
  },
  {
    eyebrow: "02 / Direction",
    title: "不要求你本来就是模特",
    body: "现场会给动作指导。走路、坐下、不看镜头、大头照、游客照，都可以自然完成。",
    image: galleryPhotos[1],
  },
  {
    eyebrow: "03 / Device",
    title: "设备可以很自由",
    body: "我会用自己的设备，也可以用你的设备拍。数码、胶片、CCD、拍立得都可以提前沟通。",
    image: galleryPhotos[3],
  },
  {
    eyebrow: "04 / Local",
    title: "熟悉赫尔辛基现场",
    body: "我在这里生活两年，也是在校学生，更清楚该去哪拍、怎么走、哪段路更适合你。",
    image: galleryPhotos[2],
  },
  {
    eyebrow: "05 / Mood",
    title: "稳定、耐心，也好相处",
    body: "拍摄过程会轻松一点。我可以帮你扛东西和器材，也可以像摄影搭子一样一起行动。",
    image: galleryPhotos[4],
  },
  {
    eyebrow: "06 / Companion",
    title: "可以像地陪一样带你玩",
    body: "如果你愿意，我也可以顺路带你吃吃喝喝，把拍摄变成半天城市散步。",
    image: galleryPhotos[5],
  },
  {
    eyebrow: "07 / Clear rules",
    title: "规则提前写清楚",
    body: "价格、交付、取消和额外费用都会提前确认，网站和小红书也会持续写清楚。",
    image: coverPhoto,
  },
  {
    eyebrow: "08 / Travel",
    title: "全欧可飞，也接受亚洲旅拍",
    body: "你承担对应路费、住宿、门票等成本，我就可以配合远距离路线和旅拍计划。",
    image: galleryPhotos[3],
  },
]

const serviceTypes = [
  { label: "旅拍 / 游客照", icon: MapPin },
  { label: "情侣拍照", icon: Heart },
  { label: "家庭拍照", icon: Users },
  { label: "证件照", icon: Camera },
  { label: "宠物照片", icon: PawPrint },
  { label: "毕业写真", icon: GraduationCap },
  { label: "校园写真", icon: GraduationCap },
]

const languageItems = ["中文", "English", "粤语"]

const briefItems = ["人数", "日期", "大概地点", "想拍的样式"]

const fallbackMomentCards: MomentCard[] = [
  {
    ...coverPhoto,
    title: "Florence overlook",
    place: "Italy / Florence",
    note: "旅途中停下来的一段城市视角。",
    featured: true,
    tags: ["意大利", "旅行感", "城市漫步"],
  },
  {
    ...galleryPhotos[2],
    title: "City walk portrait",
    place: "Helsinki / street",
    note: "不强摆，边走边拍的日常感。",
    featured: false,
    tags: ["赫尔辛基", "城市漫步", "自然街拍"],
  },
  {
    ...galleryPhotos[1],
    title: "Soft portrait",
    place: "Nordic light",
    note: "更安静、靠近人的 portrait。",
    featured: false,
    tags: ["自然街拍", "旅行感"],
  },
  {
    ...galleryPhotos[3],
    title: "Travel portrait",
    place: "Europe",
    note: "适合旅拍、游客照和社交平台画幅。",
    featured: true,
    tags: ["旅行感", "城市漫步"],
  },
  {
    ...galleryPhotos[4],
    title: "Editorial mood",
    place: "Style group",
    note: "我最满意的视觉方向之一。",
    featured: true,
    tags: ["自然街拍", "旅行感"],
  },
  {
    ...galleryPhotos[5],
    title: "Campus / daily",
    place: "Helsinki / Aalto",
    note: "适合校园写真、毕业记录和学生日常。",
    featured: false,
    tags: ["赫尔辛基", "校园", "自然街拍"],
  },
]

const fallbackMomentGroups: MomentGroup[] = [
  {
    id: "group-02",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-006",
      src: "/photo-session/微信图片_20261004190744_181_230.jpg",
      alt: "摄影作品 6",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-007",
      src: "/photo-session/微信图片_20261004190745_182_230.jpg",
      alt: "摄影作品 7",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-008",
      src: "/photo-session/微信图片_20261004190748_183_230.jpg",
      alt: "摄影作品 8",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-009",
      src: "/photo-session/微信图片_20261004190749_184_230.jpg",
      alt: "摄影作品 9",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-010",
      src: "/photo-session/微信图片_20261004190750_185_230.jpg",
      alt: "摄影作品 10",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-03",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-011",
      src: "/photo-session/微信图片_20261004190832_186_230.jpg",
      alt: "摄影作品 11",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-012",
      src: "/photo-session/微信图片_20261004190833_187_230.jpg",
      alt: "摄影作品 12",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-013",
      src: "/photo-session/微信图片_20261004190835_188_230.jpg",
      alt: "摄影作品 13",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-014",
      src: "/photo-session/微信图片_20261004190838_189_230.jpg",
      alt: "摄影作品 14",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-015",
      src: "/photo-session/微信图片_20261004190839_190_230.jpg",
      alt: "摄影作品 15",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-04",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-016",
      src: "/photo-session/微信图片_20261004190942_191_230.jpg",
      alt: "摄影作品 16",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-017",
      src: "/photo-session/微信图片_20261004190944_192_230.jpg",
      alt: "摄影作品 17",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-018",
      src: "/photo-session/微信图片_20261004190945_193_230.jpg",
      alt: "摄影作品 18",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-019",
      src: "/photo-session/微信图片_20261004190947_194_230.jpg",
      alt: "摄影作品 19",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-020",
      src: "/photo-session/微信图片_20261004191040_195_230.jpg",
      alt: "摄影作品 20",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-05",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-021",
      src: "/photo-session/微信图片_20261004191127_196_230.jpg",
      alt: "摄影作品 21",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-022",
      src: "/photo-session/微信图片_20261004191129_197_230.jpg",
      alt: "摄影作品 22",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-023",
      src: "/photo-session/微信图片_20261004191130_198_230.jpg",
      alt: "摄影作品 23",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-024",
      src: "/photo-session/微信图片_20261004191132_199_230.jpg",
      alt: "摄影作品 24",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-025",
      src: "/photo-session/微信图片_20261004191133_200_230.jpg",
      alt: "摄影作品 25",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-06",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-026",
      src: "/photo-session/微信图片_20261004191134_201_230.jpg",
      alt: "摄影作品 26",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-027",
      src: "/photo-session/微信图片_20261004191135_202_230.jpg",
      alt: "摄影作品 27",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-028",
      src: "/photo-session/微信图片_20261004191136_203_230.jpg",
      alt: "摄影作品 28",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-029",
      src: "/photo-session/微信图片_20261004191137_204_230.jpg",
      alt: "摄影作品 29",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-030",
      src: "/photo-session/微信图片_20261004191219_205_230.jpg",
      alt: "摄影作品 30",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-07",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-031",
      src: "/photo-session/微信图片_20261004191220_206_230.jpg",
      alt: "摄影作品 31",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-032",
      src: "/photo-session/微信图片_20261004191223_207_230.jpg",
      alt: "摄影作品 32",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-033",
      src: "/photo-session/微信图片_20261004191247_208_230.jpg",
      alt: "摄影作品 33",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-034",
      src: "/photo-session/微信图片_20261004191347_209_230.jpg",
      alt: "摄影作品 34",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-035",
      src: "/photo-session/微信图片_20261004191349_210_230.jpg",
      alt: "摄影作品 35",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-08",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-036",
      src: "/photo-session/微信图片_20261004191350_211_230.jpg",
      alt: "摄影作品 36",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-037",
      src: "/photo-session/微信图片_20261004191351_212_230.jpg",
      alt: "摄影作品 37",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-038",
      src: "/photo-session/微信图片_20261004191352_213_230.jpg",
      alt: "摄影作品 38",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-039",
      src: "/photo-session/微信图片_20261004191357_214_230.jpg",
      alt: "摄影作品 39",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-040",
      src: "/photo-session/微信图片_20261004191423_215_230.jpg",
      alt: "摄影作品 40",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-09",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-041",
      src: "/photo-session/微信图片_20261004191532_216_230.jpg",
      alt: "摄影作品 41",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-042",
      src: "/photo-session/微信图片_20261004191534_217_230.jpg",
      alt: "摄影作品 42",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-043",
      src: "/photo-session/微信图片_20261004191535_218_230.jpg",
      alt: "摄影作品 43",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-044",
      src: "/photo-session/微信图片_20261004191623_219_230.jpg",
      alt: "摄影作品 44",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-045",
      src: "/photo-session/微信图片_20261004191626_221_230.jpg",
      alt: "摄影作品 45",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-10",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-046",
      src: "/photo-session/微信图片_20261004191628_223_230.jpg",
      alt: "摄影作品 46",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-047",
      src: "/photo-session/微信图片_20261004191727_228_230.jpg",
      alt: "摄影作品 47",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-048",
      src: "/photo-session/微信图片_20261004191728_229_230.jpg",
      alt: "摄影作品 48",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-049",
      src: "/photo-session/微信图片_20261004191730_230_230.jpg",
      alt: "摄影作品 49",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-050",
      src: "/photo-session/微信图片_20261004191820_231_230.jpg",
      alt: "摄影作品 50",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-11",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-051",
      src: "/photo-session/微信图片_20261004191821_232_230.jpg",
      alt: "摄影作品 51",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-052",
      src: "/photo-session/微信图片_20261004191823_233_230.jpg",
      alt: "摄影作品 52",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-053",
      src: "/photo-session/微信图片_20261004191824_234_230.jpg",
      alt: "摄影作品 53",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-054",
      src: "/photo-session/微信图片_20261004191826_235_230.jpg",
      alt: "摄影作品 54",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-055",
      src: "/photo-session/微信图片_20261004192254_236_230.jpg",
      alt: "摄影作品 55",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-12",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-056",
      src: "/photo-session/微信图片_20261004192255_237_230.jpg",
      alt: "摄影作品 56",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-057",
      src: "/photo-session/微信图片_20261004192257_238_230.jpg",
      alt: "摄影作品 57",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-058",
      src: "/photo-session/微信图片_20261004192258_239_230.jpg",
      alt: "摄影作品 58",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-059",
      src: "/photo-session/微信图片_20261004192259_240_230.jpg",
      alt: "摄影作品 59",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-060",
      src: "/photo-session/微信图片_20261004192301_241_230.jpg",
      alt: "摄影作品 60",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-13",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-061",
      src: "/photo-session/微信图片_20261004192304_243_230.jpg",
      alt: "摄影作品 61",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-062",
      src: "/photo-session/微信图片_20261004192306_244_230.jpg",
      alt: "摄影作品 62",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-063",
      src: "/photo-session/微信图片_20261004192507_245_230.jpg",
      alt: "摄影作品 63",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-064",
      src: "/photo-session/微信图片_20261004192510_246_230.jpg",
      alt: "摄影作品 64",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-065",
      src: "/photo-session/微信图片_20261004192511_247_230.jpg",
      alt: "摄影作品 65",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-14",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-066",
      src: "/photo-session/微信图片_20261004192513_248_230.jpg",
      alt: "摄影作品 66",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-067",
      src: "/photo-session/微信图片_20261004192515_249_230.jpg",
      alt: "摄影作品 67",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-068",
      src: "/photo-session/微信图片_20261004192517_250_230.jpg",
      alt: "摄影作品 68",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-069",
      src: "/photo-session/微信图片_20261004192519_251_230.jpg",
      alt: "摄影作品 69",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-070",
      src: "/photo-session/微信图片_20261004192522_252_230.jpg",
      alt: "摄影作品 70",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-15",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-071",
      src: "/photo-session/微信图片_20261004192524_253_230.jpg",
      alt: "摄影作品 71",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-072",
      src: "/photo-session/微信图片_20261004192527_254_230.jpg",
      alt: "摄影作品 72",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-073",
      src: "/photo-session/微信图片_20261004192535_255_230.jpg",
      alt: "摄影作品 73",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-074",
      src: "/photo-session/微信图片_20261004192539_256_230.jpg",
      alt: "摄影作品 74",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-075",
      src: "/photo-session/微信图片_20261004192543_257_230.jpg",
      alt: "摄影作品 75",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-16",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-076",
      src: "/photo-session/微信图片_20261004192547_258_230.jpg",
      alt: "摄影作品 76",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-077",
      src: "/photo-session/微信图片_20261004192551_259_230.jpg",
      alt: "摄影作品 77",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-078",
      src: "/photo-session/微信图片_20261004192553_260_230.jpg",
      alt: "摄影作品 78",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-079",
      src: "/photo-session/微信图片_20261004192557_261_230.jpg",
      alt: "摄影作品 79",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
        {
      id: "p-080",
      src: "/photo-session/微信图片_20261004192600_262_230.jpg",
      alt: "摄影作品 80",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
  {
    id: "group-17",
    title: "CN",
    place: "CN",
    note: "",
    tags: ["摄影作品"],
    photos: [
        {
      id: "p-081",
      src: "/photo-session/微信图片_20261004192602_263_230.jpg",
      alt: "摄影作品 81",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    ],
  },
]

const localOuterMomentGroup: MomentGroup = {
  id: "group-01",
  title: "CN",
  place: "CN",
  note: "",
  tags: ["摄影作品"],
  photos: [
    {
      id: "p-001",
      src: "/photo-session/微信图片_20261004190518_176_230.jpg",
      alt: "摄影作品 1",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    {
      id: "p-002",
      src: "/photo-session/微信图片_20261004190737_177_230.jpg",
      alt: "摄影作品 2",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    {
      id: "p-003",
      src: "/photo-session/微信图片_20261004190738_178_230.jpg",
      alt: "摄影作品 3",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    {
      id: "p-004",
      src: "/photo-session/微信图片_20261004190740_179_230.jpg",
      alt: "摄影作品 4",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    {
      id: "p-005",
      src: "/photo-session/微信图片_20261004190742_180_230.jpg",
      alt: "摄影作品 5",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
  ],
}

const extraWhyMePhotos: MomentCard[] = [
    {
      id: "p-007",
      src: "/photo-session/微信图片_20261004190745_182_230.jpg",
      alt: "摄影作品 7",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
    {
      id: "p-008",
      src: "/photo-session/微信图片_20261004190748_183_230.jpg",
      alt: "摄影作品 8",
      title: "CN",
      place: "CN",
      note: "",
      tags: ["摄影作品"],
    },
]

const testimonials: Testimonial[] = [
  {
    quote: "一开始其实很担心自己不会拍照，但现场不是那种被命令摆姿势的感觉。会边走边调整动作，也会告诉我手放哪里、看哪里，最后照片比我平时自拍自然很多。",
    name: "Z. Li",
    context: "第一次单人约拍",
  },
  {
    quote: "路线不是把景点一个个打卡，而是会看光线和我们当时的状态。拍完有一些远景，也有很多聊天走路时抓到的瞬间，比较像真的旅行记忆。",
    name: "Rico",
    context: "瑞士旅拍",
  },
  {
    quote: "我不太喜欢太正式的毕业照，所以重点放在校园、衣服和当天的情绪上。成片没有很僵，也保留了学校环境，发给家里人和朋友都很合适。",
    name: "H. Jia",
    context: "校园 / 毕业记录",
  },
  {
    quote: "沟通的时候会把价格、加钱项和交付讲清楚，所以拍之前没有那种不确定感。现场也会帮忙看包、看衣服，整体更像有人一起把这件事照顾好。",
    name: "D. Wang",
    context: "旅行人像",
  },
  {
    quote: "我只给了大概想去的地点，最后路线被重新排过，基本没有把时间浪费在乱走上。照片里既有地点，也有人在里面的状态。",
    name: "Junjie",
    context: "旅途中记录",
  },
  {
    quote: "收到图以后最喜欢的是那些没有刻意看镜头的照片。它们不是模板照，更像那天真的发生过的片段，这一点对我来说很重要。",
    name: "M. Chen",
    context: "自然街拍",
  },
]

const packages = [
  {
    name: "单人",
    price: "EUR 99",
    note: "2 小时",
  },
  {
    name: "双人 / 情侣",
    price: "EUR 139",
    note: "2 小时",
  },
  {
    name: "三人",
    price: "EUR 169",
    note: "2 小时",
  },
  {
    name: "四人及以上",
    price: "另议",
    note: "按人数和路线确认",
  },
]

const includedItems = [
  "拍摄前路线和风格沟通",
  "2 小时拍摄与动作引导",
  "筛选后 JPG 底片",
  "9 张精修",
  "9 张精修图对应 RAW 文件",
]

const boundaryItems = [
  "续时 EUR 40 / 小时；额外精修 EUR 2 / 张",
  "下雪或小雨如确认继续拍摄，加 EUR 5 / 小时",
  "旅拍、远距离地点、门票和交通费需实报实销",
  "精心二次后期后仍不满意，可以要求退款",
  "妆发需自理；未经同意不会公开发布照片",
]

const bookingProcessItems = [
  "私信沟通并选定套餐",
  "约定时间和地点，拍摄当天提前会合",
  "拍完后五天以内返回照片；加钱可加急",
]

const faqs = [
  {
    question: "可以拍视频吗？",
    answer: "目前只接照片拍摄，不接正式视频拍摄。我的重点会放在静态照片里的人物状态、地点感和旅行氛围。",
  },
  {
    question: "预约之后会发生什么？",
    answer: "确认预约后，我会和你对齐套餐、集合点、拍摄时间、穿搭和想要的感觉。拍摄前可以继续私信沟通，把不确定的地方先处理掉。",
  },
  {
    question: "需要提前多久预约？",
    answer: "建议至少提前一周来问，旺季或旅行日期比较固定时最好提前四周。临时约也可以问，但不保证一定能接；如果是求婚、惊喜或需要隐藏安排的拍摄，建议至少提前两周。",
  },
  {
    question: "赫尔辛基约拍多少钱？",
    answer: "基础价格按上面的套餐走：单人 EUR 99 / 2 小时起，双人 / 情侣 EUR 139 / 2 小时起。具体情况会按实际拍摄安排、人数和交付需求略微调整，确认前会先说清楚。",
  },
  {
    question: "在赫尔辛基找摄影师值得吗？",
    answer: "如果你希望把旅行、毕业、纪念日或普通的一天留下来，是值得的。当地摄影师会更熟悉光线、天气、适合走路的区域和不太挤的角度，照片会比单纯打卡更像你那天真实的状态。",
  },
  {
    question: "拍摄当天和交付时间是怎样的？",
    answer: "拍摄当天建议提前 10 分钟到集合点，先确认当天目标和节奏。拍完后一般五天以内返回照片；如果你需要更快拿到图，可以提前说，加急会单独加钱。",
  },
  {
    question: "阴天还能拍吗？",
    answer: "阴天可以正常拍，柔光反而适合人像。下雪或小雨也可以拍，但会加 EUR 5 / 小时；恶劣天气可以免费改期或取消。",
  },
  {
    question: "怎么付款和取消？",
    answer: "确认档期需要支付总价 50% 订金。拍摄前 24 小时外取消可退订金，24 小时内取消订金不退。支持微信、支付宝、Revolut、MobilePay。",
  },
  {
    question: "如果我迟到了怎么办？",
    answer: "我会在约定地点等你，但拍摄时间会从我们约定的开始时间计时，不会从你实际到达后重新开始。请尽量准时到达，这样 2 小时才会完整用在拍摄上。",
  },
  {
    question: "如果精修风格不满意呢？",
    answer: "可以先沟通二次后期。如果精心二次后期之后你仍然不满意，可以要求退款。",
  },
  {
    question: "可以去赫尔辛基以外吗？",
    answer: "可以。Base赫尔辛基，但拍摄不只限芬兰，全欧可飞。远距离路线、欧洲其他城市或亚洲旅拍，需要你承担对应路费、住宿、门票和必要转场费用。",
  },
  {
    question: "交付包含什么？",
    answer: "基础包含筛选后 JPG 底片、9 张精修，以及 9 张精修图对应 RAW 文件。额外精修 EUR 2 / 张，续时 EUR 40 / 小时。",
  },
  {
    question: "衣服需要提前准备吗？",
    answer: "建议提前看颜色和层次。赫尔辛基风大，外套、围巾或能随手搭的单品会更好拍；如果你不确定，也可以把衣服发给我一起看。",
  },
  {
    question: "照片会被公开发布吗？",
    answer: "不会默认公开。未经你同意，我不会把你的照片发布到网站、小红书或其他公开平台。",
  },
]

export function HelsinkiPhotoSession() {
  const router = useRouter()
  const { locale, setLocale } = useI18n()
  const pageLocale: Locale = locale === "en" ? "en" : "zh"
  const copy = photoSessionCopy[pageLocale]
  const [isEntering, setIsEntering] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [activeLocationId, setActiveLocationId] = useState(locations[0].id)
  const [momentGroups, setMomentGroups] = useState<MomentGroup[]>(fallbackMomentGroups)
  const [whyMePhotos, setWhyMePhotos] = useState<MomentCard[]>([])
  const [momentScrollStage, setMomentScrollStage] = useState(0)
  const [selectedPackageIndex, setSelectedPackageIndex] = useState(0)
  const [isEmailFormOpen, setIsEmailFormOpen] = useState(false)
  const [bookingForm, setBookingForm] = useState({
    name: "",
    contact: "",
    date: "",
    people: "",
    style: "",
    note: "",
  })
  const [bookingStatus, setBookingStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [bookingMessage, setBookingMessage] = useState("")
  const [mapReady, setMapReady] = useState(false)
  const scrollAnimationRef = useRef<number | null>(null)
  const highlightRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const stepRefs = useRef<Array<HTMLElement | null>>([])
  const locationRefs = useRef<Array<HTMLElement | null>>([])
  const testimonialScrollerRef = useRef<HTMLDivElement | null>(null)
  const momentsSectionRef = useRef<HTMLElement | null>(null)
  const mapRootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const displayShootSteps = useMemo(
    () =>
      shootSteps.map((step, index) => ({
        ...step,
        title: copy.process.steps[index]?.title || step.title,
        body: copy.process.steps[index]?.body || step.body,
      })),
    [copy],
  )
  const displayLocations = useMemo(
    () =>
      locations.map((location, index) => ({
        ...location,
        place: copy.locations.points[index]?.place || location.place,
        bestTime: copy.locations.points[index]?.bestTime || location.bestTime,
      })),
    [copy],
  )
  const activeStep = displayShootSteps[activeStepIndex] ?? displayShootSteps[0]
  const activeLocation = locations.find((location) => location.id === activeLocationId) ?? locations[0]
  const activeDisplayLocation = displayLocations.find((location) => location.id === activeLocationId) ?? displayLocations[0]
  const selectedPackage = copy.pricing.packages[selectedPackageIndex] ?? copy.pricing.packages[0]
  const primaryMomentGroups = useMemo(() => {
    const groups = momentGroups.filter(
      (group) => !["lijie", "jianji-xinyi", "hongjia-oeschinen"].includes(group.id) && group.photos.length >= 1,
    )
    return [localOuterMomentGroup, ...(groups.length > 0 ? groups : fallbackMomentGroups)]
  }, [momentGroups])
  const featureMomentGroups = useMemo(() => {
    const orderedGroups = ["jianji-xinyi"]
      .map((id) => momentGroups.find((group) => group.id === id))
      .filter((group): group is MomentGroup => Boolean(group))
    return orderedGroups.length > 0 ? orderedGroups : primaryMomentGroups.slice(0, 4)
  }, [momentGroups, primaryMomentGroups])
  const lijiePhotos = useMemo(() => momentGroups.find((group) => group.id === "lijie")?.photos ?? [], [momentGroups])
  const aboutPhoto = useMemo(() => {
    return lijiePhotos[0] || coverPhoto
  }, [lijiePhotos])
  const aboutVisualPhotos = useMemo(() => {
    const seen = new Set<string>()
    const photos = (lijiePhotos.length > 0 ? lijiePhotos : [aboutPhoto]).filter((photo) => {
      if (!photo?.src || seen.has(photo.src)) return false
      seen.add(photo.src)
      return true
    })
    return photos.length > 0 ? photos : [coverPhoto]
  }, [aboutPhoto, lijiePhotos])
  const activeAboutPhoto = aboutVisualPhotos[activeHighlightIndex % aboutVisualPhotos.length] ?? aboutPhoto
  const shootVisualPhotos = useMemo(() => {
    const fallbackPhotos = shootSteps.map((step, index) => {
      const extraIndex = index - (shootSteps.length - extraWhyMePhotos.length)
      return extraWhyMePhotos[extraIndex] ?? step.image
    })
    const basePhotos = whyMePhotos.length > 0 ? [...whyMePhotos, ...extraWhyMePhotos, ...fallbackPhotos] : fallbackPhotos
    const seen = new Set<string>()
    return basePhotos.filter((photo) => {
      if (!photo.src || seen.has(photo.src)) return false
      seen.add(photo.src)
      return true
    }).slice(0, shootSteps.length)
  }, [whyMePhotos])
  const activeShootPhoto = shootVisualPhotos[activeStepIndex % shootVisualPhotos.length] ?? activeStep.image

  const updateBookingField = (field: keyof typeof bookingForm, value: string) => {
    setBookingForm((current) => ({ ...current, [field]: value }))
  }

  const handleBookingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBookingStatus("sending")
    setBookingMessage("")

    try {
      const response = await fetch("/api/photo-session-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName: selectedPackage.name,
          packagePrice: selectedPackage.price,
          packageNote: selectedPackage.note,
          dateLabel: bookingForm.date,
          timeWindow: copy.form.timeWindow,
          timeWindowNote: copy.form.timeWindowNote,
          ...bookingForm,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(String(payload.error || "Booking request failed"))
      }
      setBookingStatus("sent")
      setBookingMessage(
        pageLocale === "en"
          ? payload.emailSent
            ? copy.form.sentMessage
            : copy.form.loggedMessage
          : String(payload.message || copy.form.sentMessage),
      )
      setIsEmailFormOpen(false)
    } catch (error) {
      setBookingStatus("error")
      setBookingMessage(pageLocale === "en" ? copy.form.errorMessage : String((error as Error).message || copy.form.errorMessage))
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadTaggedMoments = async () => {
      try {
        const response = await fetch("/api/photo-session-moments?limit=8", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(String(payload.error || "Failed to load photo session moments"))
        }

        const isMomentCard = (moment: unknown): moment is MomentCard => {
          const card = moment as Partial<MomentCard> | null
          return Boolean(
            card &&
              typeof card.id === "string" &&
              typeof card.src === "string" &&
              typeof card.alt === "string" &&
              typeof card.title === "string" &&
              typeof card.place === "string" &&
              typeof card.note === "string" &&
              Array.isArray(card.tags),
          )
        }
        const groups: MomentGroup[] = (Array.isArray(payload.groups) ? payload.groups : [])
          .map((group: unknown): MomentGroup | null => {
            const candidate = group as Partial<MomentGroup> | null
            const photos = (candidate && Array.isArray(candidate.photos) ? candidate.photos : []).filter(isMomentCard)
            if (
              !candidate ||
              typeof candidate.id !== "string" ||
              typeof candidate.title !== "string" ||
              typeof candidate.place !== "string" ||
              typeof candidate.note !== "string" ||
              !Array.isArray(candidate.tags) ||
              photos.length === 0
            ) {
              return null
            }

            return {
              id: candidate.id,
              title: candidate.title,
              place: candidate.place,
              note: candidate.note,
              featured: Boolean(candidate.featured),
              photoCount: Number(candidate.photoCount || photos.length),
              tags: candidate.tags.filter((tag: unknown): tag is string => typeof tag === "string"),
              photos,
            }
          })
          .filter((group: MomentGroup | null): group is MomentGroup => Boolean(group))

        const aboutCard = isMomentCard(payload.aboutPhoto) ? payload.aboutPhoto : null
        const cards: MomentCard[] = (Array.isArray(payload.moments) ? payload.moments : []).filter(isMomentCard)
        const nextWhyMePhotos: MomentCard[] = (Array.isArray(payload.whyMePhotos) ? payload.whyMePhotos : []).filter(isMomentCard)

        if (!cancelled && nextWhyMePhotos.length > 0) {
          setWhyMePhotos(nextWhyMePhotos)
        }

        if (!cancelled && groups.length > 0) {
          if (aboutCard && !groups.some((group) => group.id === "lijie")) {
            setMomentGroups([
              ...groups,
              {
                id: "lijie",
                title: "Lijie",
                place: aboutCard.place,
                note: "About 区域使用的本人照片。",
                featured: aboutCard.featured,
                photoCount: 1,
                tags: aboutCard.tags,
                photos: [aboutCard],
              },
            ])
            return
          }

          setMomentGroups(groups)
          return
        }

        if (!cancelled && cards.length > 0) {
          setMomentGroups([
            {
              id: "loaded-moments",
              title: "People",
              place: "Travel routes",
              note: "按图片标签加载的人像组合。",
              featured: cards.some((card) => card.featured),
              photoCount: cards.length,
              tags: Array.from(new Set(cards.flatMap((card) => card.tags))).slice(0, 4),
              photos: cards,
            },
          ])
        }
      } catch (error) {
        console.warn("Failed to load tagged photo session moments:", error)
      }
    }

    loadTaggedMoments()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const scroller = testimonialScrollerRef.current
    if (!scroller) return

    const timer = window.setInterval(() => {
      const step = Math.max(280, Math.round(scroller.clientWidth * 0.72))
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
      const nextLeft = scroller.scrollLeft + step >= maxScrollLeft - 8 ? 0 : scroller.scrollLeft + step
      scroller.scrollTo({ left: nextLeft, behavior: "smooth" })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setIsEntering(false), 80)
    return () => {
      window.clearTimeout(timer)
      if (scrollAnimationRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const updateMomentStage = () => {
      const node = momentsSectionRef.current
      if (!node) return

      const rect = node.getBoundingClientRect()
      const scrollable = Math.max(rect.height - window.innerHeight, 1)
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
      setMomentScrollStage(progress)
    }

    updateMomentStage()
    window.addEventListener("scroll", updateMomentStage, { passive: true })
    window.addEventListener("resize", updateMomentStage)
    return () => {
      window.removeEventListener("scroll", updateMomentStage)
      window.removeEventListener("resize", updateMomentStage)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const mountMap = async () => {
      const root = mapRootRef.current
      if (!root) return

      setMapReady(false)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersLayerRef.current = null
      }

      root.innerHTML = ""
      const leafletRoot = root as HTMLDivElement & { _leaflet_id?: number }
      delete leafletRoot._leaflet_id

      const leaflet = await import("leaflet")
      if (cancelled || !mapRootRef.current) return

      const map = leaflet.map(root, {
        center: [60.17045, 24.95223],
        zoom: 12,
        minZoom: 10,
        maxZoom: 17,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: false,
      })

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          tileSize: 256,
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap",
        })
        .addTo(map)

      const bounds = leaflet.latLngBounds(locations.map((location) => [location.lat, location.lng]))
      map.fitBounds(bounds.pad(0.18), { animate: false })
      mapRef.current = map
      markersLayerRef.current = leaflet.layerGroup().addTo(map)
      window.requestAnimationFrame(() => {
        map.invalidateSize()
        map.fitBounds(bounds.pad(0.18), { animate: false })
      })
      setMapReady(true)
    }

    void mountMap()
    const handleResize = () => {
      if (!mapRef.current) return
      mapRef.current.invalidateSize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelled = true
      window.removeEventListener("resize", handleResize)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersLayerRef.current = null
      }
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncMarkers = async () => {
      if (!mapReady || !mapRef.current || !markersLayerRef.current) return
      const leaflet = await import("leaflet")
      if (cancelled || !mapRef.current || !markersLayerRef.current) return

      markersLayerRef.current.clearLayers()
      leaflet
        .polyline(
          locations.map((location) => [location.lat, location.lng]),
          {
            color: "#355d63",
            weight: 2,
            opacity: 0.56,
            dashArray: "6 10",
          },
        )
        .addTo(markersLayerRef.current)

      locations.forEach((location, index) => {
        const isActive = location.id === activeLocationId
        const marker = leaflet.marker([location.lat, location.lng], {
            icon: leaflet.divIcon({
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17],
              html: `<span style="display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #20231f;background:${isActive ? "#d7c4a5" : "#355d63"};color:${isActive ? "#20231f" : "#fff"};font-size:14px;font-weight:700;box-shadow:0 14px 34px -18px rgba(32,35,31,.9);">${index + 1}</span>`,
            }),
          })
          .on("click", () => {
            setActiveLocationId(location.id)
            mapRef.current?.setView([location.lat, location.lng], Math.max(mapRef.current.getZoom(), 13), { animate: true })
          })
          .on("mouseover", () => setActiveLocationId(location.id))
          .addTo(markersLayerRef.current)

        marker.bindTooltip(`${index + 1}. ${location.name}`, {
          permanent: isActive,
          direction: "top",
          offset: [0, -10],
          opacity: 0.96,
          className: "photo-session-map-tooltip",
        })
      })
    }

    void syncMarkers()
    return () => {
      cancelled = true
    }
  }, [activeLocationId, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    mapRef.current.setView([activeLocation.lat, activeLocation.lng], Math.max(mapRef.current.getZoom(), 13), { animate: true })
  }, [activeLocation.lat, activeLocation.lng, mapReady])

  useEffect(() => {
    const updateActiveHighlightFromScroll = () => {
      const candidates = highlightRefs.current
        .map((node, index) => (node ? { node, index } : null))
        .filter((item): item is { node: HTMLParagraphElement; index: number } => Boolean(item))
      if (candidates.length === 0) return

      const anchor = window.innerHeight * 0.46
      const nearest = candidates.reduce<{ index: number; distance: number } | null>((best, item) => {
        const rect = item.node.getBoundingClientRect()
        const target = rect.top + rect.height * 0.5
        const distance = Math.abs(target - anchor)
        return !best || distance < best.distance ? { index: item.index, distance } : best
      }, null)

      if (!nearest) return
      setActiveHighlightIndex((current) => (current === nearest.index ? current : nearest.index))
    }

    updateActiveHighlightFromScroll()
    window.addEventListener("scroll", updateActiveHighlightFromScroll, { passive: true })
    window.addEventListener("resize", updateActiveHighlightFromScroll)
    return () => {
      window.removeEventListener("scroll", updateActiveHighlightFromScroll)
      window.removeEventListener("resize", updateActiveHighlightFromScroll)
    }
  }, [pageLocale])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        const id = visibleEntry?.target.getAttribute("data-location-id")
        if (id) setActiveLocationId(id)
      },
      { rootMargin: "-36% 0px -42% 0px", threshold: [0.2, 0.45, 0.7] },
    )

    locationRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateActiveStepFromScroll = () => {
      const candidates = stepRefs.current
        .map((node, index) => (node ? { node, index } : null))
        .filter((item): item is { node: HTMLElement; index: number } => Boolean(item))
      if (candidates.length === 0) return

      const anchor = window.innerHeight * 0.46
      const nearest = candidates.reduce<{ index: number; distance: number } | null>((best, item) => {
        const rect = item.node.getBoundingClientRect()
        const target = rect.top + rect.height * 0.42
        const distance = Math.abs(target - anchor)
        return !best || distance < best.distance ? { index: item.index, distance } : best
      }, null)

      if (!nearest) return
      setActiveStepIndex((current) => (current === nearest.index ? current : nearest.index))
    }

    updateActiveStepFromScroll()
    window.addEventListener("scroll", updateActiveStepFromScroll, { passive: true })
    window.addEventListener("resize", updateActiveStepFromScroll)
    return () => {
      window.removeEventListener("scroll", updateActiveStepFromScroll)
      window.removeEventListener("resize", updateActiveStepFromScroll)
    }
  }, [])

  const handleSectionLink = (sectionId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const target = document.getElementById(sectionId)
    if (!target) return

    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current)
    }

    const startY = window.scrollY
    const documentHeight = document.documentElement.scrollHeight
    const viewportHeight = window.innerHeight
    const targetY = Math.min(target.getBoundingClientRect().top + startY, documentHeight - viewportHeight)
    const distance = targetY - startY
    const duration = Math.min(1100, Math.max(620, Math.abs(distance) * 0.08))
    const startTime = window.performance.now()
    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration)
      window.scrollTo(0, startY + distance * easeOutCubic(progress))

      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step)
        return
      }

      scrollAnimationRef.current = null
      window.history.replaceState(null, "", `#${sectionId}`)
    }

    scrollAnimationRef.current = window.requestAnimationFrame(step)
  }

  const handlePortfolioLink = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsLeaving(true)
    window.setTimeout(() => {
      router.push("/portfolio?from=photo-session")
    }, 420)
  }

  const handleLanguageToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setLocale(pageLocale === "zh" ? "en" : "zh")
  }

  const handleScrollTop = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current)
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
    window.history.replaceState(null, "", window.location.pathname)
  }

  return (
    <main
      className="min-h-screen select-none bg-[#f5f2ec] font-['Manrope'] text-[#151612]"
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className={`pointer-events-none fixed inset-0 z-[10000] bg-white transition-opacity duration-500 ease-out ${
          isEntering || isLeaving ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        className="fixed right-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-md border border-white/28 bg-black/42 px-3 text-sm font-semibold text-white shadow-[0_18px_42px_-28px_rgba(0,0,0,0.82)] backdrop-blur transition hover:bg-black/58 sm:right-6 sm:top-6"
        onClick={handleLanguageToggle}
        aria-label={copy.languageLabel}
        title={copy.languageLabel}
      >
        <Languages className="h-4 w-4" />
        {copy.languageButton}
      </button>

      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#050505] text-white">
        <SessionImage
          src={coverPhoto.src}
          alt={coverPhoto.alt}
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.48)_48%,rgba(0,0,0,0.14)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-[18svh] pt-28 sm:px-8 lg:pb-[20svh]">
          <div className="max-w-6xl">
            <h1 className="mt-4 max-w-6xl text-5xl font-semibold leading-[0.94] tracking-normal text-white sm:text-7xl lg:text-[6.8rem]">
              {copy.hero.title}
            </h1>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button type="button" className="h-11 rounded-md bg-white px-5 text-[#151612] hover:bg-white/90" onClick={handleSectionLink("moments")}>
                <ArrowDown className="h-4 w-4" />
                {copy.hero.samples}
              </Button>
              <Button type="button" variant="secondary" className="h-11 rounded-md bg-white/12 px-5 text-white hover:bg-white/20" onClick={handleSectionLink("story")}>
                <Images className="h-4 w-4" />
                {copy.hero.portfolio}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="bg-[#050505] px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.42fr_0.58fr]">
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <p className="text-sm font-semibold uppercase text-white/40">{copy.about.eyebrow}</p>
            <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight sm:text-5xl">
              {copy.about.title}
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
              {copy.about.body}
            </p>
            <figure className="mt-8 max-w-md overflow-hidden rounded-md bg-[#050505] shadow-[0_26px_90px_-62px_rgba(255,255,255,0.45)]">
              <div className="relative flex h-[42svh] min-h-[280px] max-h-[430px] items-center justify-center overflow-hidden bg-[#050505]">
                {aboutVisualPhotos.map((photo, index) => (
                  <SessionImage
                    key={`${photo.id}-${photo.src}`}
                    src={photo.src}
                    alt={photo.alt}
                    className={`absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain transition duration-700 ${
                      activeAboutPhoto.src === photo.src ? "scale-100 opacity-100" : "scale-[0.985] opacity-0"
                    }`}
                  />
                ))}
              </div>
            </figure>
          </div>
          <div className="space-y-[15svh] pb-[8svh]">
            {copy.about.highlightLines.map((line, index) => (
              <p
                key={line}
                ref={(node) => {
                  highlightRefs.current[index] = node
                }}
                data-highlight-index={index}
                className={`max-w-4xl text-4xl font-semibold leading-tight transition duration-500 sm:text-6xl ${
                  activeHighlightIndex === index ? "text-white" : "text-white/20"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="moments" ref={momentsSectionRef} className="relative min-h-[190svh] bg-[#050505] text-white">
        <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden px-5 py-16 sm:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="relative min-h-[78svh]">
              <div
                className="absolute inset-0 transition duration-700 ease-out"
                style={{
                  opacity: Math.max(0, 1 - momentScrollStage * 1.65),
                  transform: `translateY(${-momentScrollStage * 26}px) scale(${1 - momentScrollStage * 0.025})`,
                }}
              >
                <div className="min-h-[78svh]">
                  <div className="flex snap-x items-start gap-4 overflow-x-auto pb-4 [scrollbar-width:none] lg:grid lg:min-h-[78svh] lg:grid-cols-3 lg:grid-rows-2 lg:items-stretch lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                    {primaryMomentGroups.map((group, index) => (
                      <MomentGroupFrame
                        key={group.id}
                        group={group}
                        eager={index < 2}
                        locale={pageLocale}
                        className="h-[56svh] min-h-[430px] lg:h-auto"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="absolute inset-0 transition duration-700 ease-out"
                style={{
                  opacity: Math.min(1, Math.max(0, (momentScrollStage - 0.38) / 0.42)),
                  transform: `translateY(${Math.max(0, 1 - momentScrollStage) * 32}px) scale(${0.985 + Math.min(1, momentScrollStage) * 0.015})`,
                  pointerEvents: momentScrollStage > 0.46 ? "auto" : "none",
                }}
              >
                <div className="flex min-h-[78svh] snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:none] lg:grid lg:grid-cols-1 lg:grid-rows-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                  {featureMomentGroups.slice(0, 1).map((group, index) => (
                    <MomentGroupFrame
                      key={`${group.id}-featured`}
                      group={group}
                      eager={index === 0}
                      imageFit="contain"
                      locale={pageLocale}
                      className="h-[64svh] min-h-[480px] lg:h-auto"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#ded4c6] bg-[#20231f] px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">{copy.footer.title}</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/60">{copy.footer.notice}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-md border border-white/20 bg-white/10 px-4 text-white hover:bg-white/16"
              onClick={handleScrollTop}
            >
              <ArrowDown className="h-4 w-4 rotate-180" />
              {copy.footer.top}
            </Button>
          </div>
        </div>
      </footer>
    </main>
  )
}

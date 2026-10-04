import { HelsinkiPhotoSession } from "@/components/helsinki-photo-session"

export const metadata = {
  title: "旅拍摄影师 - Lijie",
  description: "Base赫尔辛基，但拍摄不只限芬兰，全欧可飞。Portrait, travel, campus and city-walk photo sessions from EUR 99.",
}

export const revalidate = 3600

export default function HelsinkiPhotoSessionPage() {
  return <HelsinkiPhotoSession />
}

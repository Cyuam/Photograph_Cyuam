"use client"

import Image, { ImageProps } from "next/image"
import { cn } from "@/lib/utils"

interface ProtectedImageProps extends ImageProps {
    containerClassName?: string
}

export function ProtectedImage({ containerClassName, className, ...props }: ProtectedImageProps) {
    return (
        <div
            className={cn("relative select-none", containerClassName)}
            onContextMenu={(e) => {
                e.preventDefault()
                return false
            }}
        >
            {/* Transparent overlay to intercept interactions */}
            <div className="absolute inset-0 z-10 bg-transparent" />
            <Image
                {...props}
                className={cn("pointer-events-none select-none", className)}
                draggable={false}
                style={{ ...props.style, userSelect: 'none', WebkitUserSelect: 'none' }}
            />
        </div>
    )
}

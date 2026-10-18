// components/ui/BrandAssetsManager.tsx
"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

interface BrandAssetsManagerProps {
  aspectRatio: number; // مثلاً 1 برای لوگو، 16/9 برای بنر
  title: string;
  onSave: (file: File) => void;
}

export default function BrandAssetsManager({
  aspectRatio,
  title,
  onSave,
}: BrandAssetsManagerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () =>
        setImageSrc(reader.result?.toString() || null),
      );
      reader.readAsDataURL(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const onCropComplete = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleSave = async () => {
    if (imageSrc && croppedAreaPixels) {
      const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageFile) {
        onSave(croppedImageFile);
        setImageSrc(null); // بستن کراپ بعد از ذخیره
      }
    }
  };

  return (
    <div className="w-full border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
      <h3 className="font-bold text-lg text-gray-800 mb-4">{title}</h3>

      {!imageSrc ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:bg-gray-50"
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-gray-600 text-center font-medium">
            {isDragActive
              ? "عکس را اینجا رها کنید..."
              : "برای آپلود کلیک کنید یا عکس را اینجا بکشید و رها کنید"}
          </p>
        </div>
      ) : (
        <div className="relative w-full h-80 bg-gray-900 rounded-xl overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />

          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={() => setImageSrc(null)}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-red-600 transition"
            >
              لغو
            </button>
            <button
              onClick={handleSave}
              className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-green-600 transition"
            >
              تایید و برش کادر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

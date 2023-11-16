"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export default function CropModal(props: {
  file: any;
  aspectRatio: any;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  setBase64Image: (base64Image: string) => void;
  closeModalText?: string;
  onCancel: () => void;
  title?: string;
}) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({} as Crop);
  const [imageSrc, setImageSrc] = useState<string | ArrayBuffer | null>(null);

  function closeModal() {
    props.setIsOpen(false);
  }

  useEffect(() => {
    if (props.file) {
      const reader = new FileReader();

      reader.onload = async () => {
        setImageSrc(reader.result as unknown as string);

        try {
          const blob = await fetch(reader.result as string).then((res) =>
            res.blob(),
          );
          const imageBitmap = await createImageBitmap(blob);

          setImageSize({
            width: imageBitmap.width,
            height: imageBitmap.height,
          });

          console.log(imageBitmap.width, imageBitmap.height);

          // Continue with your logic, e.g., setting crop
          setCrop(
            makeAspectCrop(
              {
                unit: "%",
                width: 90,
              },
              props.aspectRatio,
              imageBitmap.width * 0.9,
              imageBitmap.height * 0.9,
            ),
          );
        } catch (error) {
          console.error("Error loading image:", error);
        }
      };

      reader.readAsDataURL(props.file);
    }
  }, [props.file]);

  const handleDone = async () => {
    if (!crop) {
      return;
    }

    // scaling
    const scaledWidth = (imageSize.width * crop.width) / 100;
    const scaledHeight = (imageSize.height * crop.height) / 100;

    const canvas = document.createElement("canvas");
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.src = imageSrc as unknown as string;

    await image.decode();

    ctx!.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      crop.x,
      crop.y,
      scaledWidth,
      scaledHeight,
    );

    const base64Image = canvas.toDataURL("image/png").toString();
    console.log(base64Image);
    props.setBase64Image(base64Image);
    props.setIsOpen(false);
  };

  const handleClose = () => {
    props.onCancel();
    props.setIsOpen(false);
  };

  return (
    <>
      <Transition appear show={props.isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md items-center transform overflow-hidden rounded-2xl bg-white p-6 align-middle shadow-xl transition-all">
                  {props.title && (
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 mb-4"
                    >
                      {props.title}
                    </Dialog.Title>
                  )}
                  {imageSrc && (
                    <ReactCrop
                      crop={crop} // error here
                      onChange={(c) => setCrop(c)}
                      aspect={props.aspectRatio}
                    >
                      <img src={imageSrc as unknown as string} />
                    </ReactCrop>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-x-6">
                    <button
                      type="button"
                      className="bg-red-700 hover:bg-red-500 text-sm font-semibold leading-6 text-white rounded-md px-3 py-2"
                      onClick={handleClose}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDone}
                      className="bg-green-700 hover:bg-green-500 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

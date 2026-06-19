interface LessonFrameProps {
  slug: string;
  file: string;
}

export function LessonFrame({ slug, file }: LessonFrameProps) {
  const src = `/api/topics/${slug}/files/${file}`;
  return (
    <iframe
      title="lesson"
      src={src}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
    />
  );
}

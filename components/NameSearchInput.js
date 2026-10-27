"use client";

// Поле «Найти сотрудника по имени» над очередями заявок.
export default function NameSearchInput({ value, onChange }) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Найти сотрудника по имени"
        aria-label="Поиск сотрудника"
        className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-4 pr-10 py-2.5 text-base text-white [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}

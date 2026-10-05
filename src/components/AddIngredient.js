import React, { useState, useContext } from 'react';
import { GlobalContext } from '../context/GlobalState';
import topIngredients from './../topIngredients.json';
import Autosuggest from 'react-autosuggest';
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

// Ingredient picker for recipe search. Suggestions come from a list of common
// ingredients, but anything typed is accepted too (press Enter). The parent can
// read what's typed but not yet added (value / onValueChange).
const AddIngredient = ({ value: controlled, onValueChange }) => {
  const [own, setOwn] = useState('');
  const value = controlled !== undefined ? controlled : own;
  const setValue = onValueChange || setOwn;
  const [suggestions, setSuggestion] = useState([]);
  const { addSearchIngredient: addIngredient, searchIngredients = [] } = useContext(GlobalContext);

  const onChange = (e, { newValue }) => {
    e.preventDefault();
    setValue(newValue);
  };

  // Adds a term unless it's empty or already chosen
  const addTerm = (text) => {
    const term = String(text || '').trim().toLowerCase().slice(0, 50);
    if (term && !searchIngredients.some((item) => item.value.toLowerCase() === term)) {
      addIngredient({ id: Math.floor(Math.random() * 100000000), value: term });
    }
    setValue('');
  };

  const onSuggestionsFetchRequested = ({ value }) => {
    setSuggestion(getSuggestions(value));
  };

  const onSuggestionsClearRequested = () => {
    setSuggestion([]);
  };

  const escapeRegexCharacters = str => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const getSuggestions = value => {
    const escapedValue = escapeRegexCharacters(value.trim());

    if (escapedValue === '') {
      return [];
    }

    const regex = new RegExp(escapedValue, 'i');

    const sortedByLength = topIngredients.sort((a, b) => {
      return a.name.length - b.name.length;
    });

    return sortedByLength.filter(ingredient => regex.test(ingredient.name));
  };

  const onSuggestionSelected = (e, { suggestionValue }) => {
    e.preventDefault();
    addTerm(suggestionValue);
  };

  const getSuggestionValue = suggestion => suggestion.name;

  const renderSuggestion = (suggestion, { query, isHighlighted }) => {
    const matches = match(suggestion.name, query);
    const parts = parse(suggestion.name, matches);
    return (
      <div>
        {parts.map((part, index) => {
          return part.highlight ? (
            <span key={String(index)} className="text-gray-900 font-normal">
              {part.text}
            </span>
          ) : (
            <strong key={String(index)} className="text-gray-600 font-normal">
              {part.text}
            </strong>
          );
        })}
      </div>
    );
  };

  const inputProps = {
    placeholder: 'Add an ingredient and press Enter, e.g. apples',
    'aria-label': 'Add an ingredient',
    value,
    onChange
  };

  return (
    <form className="fb-autosuggest" onSubmit={(e) => { e.preventDefault(); addTerm(value); }}>
      <Autosuggest
        suggestions={suggestions.slice(0, 6)}
        onSuggestionsFetchRequested={onSuggestionsFetchRequested}
        onSuggestionsClearRequested={onSuggestionsClearRequested}
        getSuggestionValue={getSuggestionValue}
        renderSuggestion={renderSuggestion}
        inputProps={inputProps}
        onSuggestionSelected={onSuggestionSelected}
      />
    </form>
  );
};

export default AddIngredient;

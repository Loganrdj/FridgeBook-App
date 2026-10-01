import React, { useState, useContext } from 'react';
import { GlobalContext } from '../context/GlobalState';
import topIngredients from './../topIngredients.json';
import Autosuggest from 'react-autosuggest';
import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

const AddIngredient = () => {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestion] = useState([]);
  const { addSearchIngredient: addIngredient } = useContext(GlobalContext);

  const onChange = (e, { newValue }) => {
    e.preventDefault();
    setValue(newValue);
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
    const newIngredient = {
      id: Math.floor(Math.random() * 100000000),
      value: suggestionValue
    };
    addIngredient(newIngredient);
    setValue('');
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
    placeholder: 'Add an ingredient, e.g. apples',
    'aria-label': 'Add an ingredient',
    value,
    onChange
  };

  return (
    <form className="fb-autosuggest" onSubmit={(e) => e.preventDefault()}>
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

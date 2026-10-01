import React, { Component } from 'react';
import "./style.css";

class IngredientInput extends Component {
    state = {
        name: "",
        date_start: ``,
        date_expire: "",
        quantity: 0,
        fridge_bool: false
    }

    updateIngredient = (event) => {
        //Input ingredient into sequelize
        const { name, value } = event.target;
        this.setState({
            [name]: value
        })
    }

    submitIngredient = (event) => {
        event.preventDefault();
        let t = new Date();
        const newIngredient = {
            ...this.state,
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            date_start: `${t.getFullYear()}-${t.getMonth()+1}-${t.getDate()}`,
            quantity: Number(this.state.quantity) || 1,
            fridge_bool: this.state.fridge_bool === 'true' || this.state.fridge_bool === true
        };

        this.props.addIngredient(newIngredient);
        this.props.afterSubmit();
        this.setState({
            name: "",
            date_start: ``,
            date_expire: "",
            quantity: 0,
            fridge_bool: false
        });
    }

    render() {
        return (
            <form>
                <div className="container">
                    <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input type="text"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="ingredient_name"
                            placeholder="Enter Ingredient Name"
                            name="name"
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Expiration Date:</label>
                        <input type="date"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="date_expire"
                            placeholder="Enter Expiration Date"
                            name="date_expire"
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Quantity:</label>
                        <input type="text"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="quantity"
                            placeholder="Enter Ingredient Quantity"
                            name="quantity"
                            required>
                        </input>
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Kitchen or Pantry:</label>
                        <div>
                        <label htmlFor="name">Kitchen</label>
                        <input type="radio" id="fridge_bool" name="fridge_bool" value={true} onChange={this.updateIngredient}></input>
                        </div>
                        <div>
                        <label htmlFor="name">Pantry</label>
                        <input type="radio" id="fridge_bool" name="fridge_bool" value={false} onChange={this.updateIngredient}></input>
                        </div>
                        
                        {/* <input type="radio"
                            onChange={this.updateIngredient}
                            className="form-control"
                            id="fridge_bool"
                            name="fridge_bool"
                            required>
                                <option value={true}>Fridge</option>
                                <option value={false}>Pantry</option>
                        </input> */}
                    </div>
                    <button type="submit" onClick={this.submitIngredient} className="px-3 py-2 rounded-md bg-black-500 text-white focus:outline-none hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">Submit</button>
                </div>
            </form>
        )
    }

}

export default IngredientInput